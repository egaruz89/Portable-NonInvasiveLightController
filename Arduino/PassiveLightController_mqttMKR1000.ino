/*
Arduino Firmware - Passive Light Controller
*/
// Required for the communication with the MQTT Broker
#include <WiFi101.h>
#include <PubSubClient.h>

// For the reading of the BMP085 sensor
#include <Wire.h>
#include <Adafruit_BMP085.h>
Adafruit_BMP085 bmp;

// For controlling the ServoMotor
#include <Servo.h>
Servo myservo;
int lastServoPosition = 0;
int onPosition = 130;
int offPosition = 60;
int middlePos = 95;

// To encode/parse Json
#include <ArduinoJson.h>

// Update these with values suitable for your network.
const char* ssid = "belkin.3830";
const char* password = "84b43867";
const char* mqtt_server = "192.168.2.2";

// Connect to the network and create the MQTT client
WiFiClient MKR1000Client;
PubSubClient client(MKR1000Client);
int magneticSensorPin = 1;
int pushButtonPin = 0;
int servoPin = 2;
int flag = 0;
int flagMag = 1;
long lastMsg1 = 0;
long lastMsg2 = 0;
// Declare some functions
void payload2Action(byte* payload, unsigned int l);

void setup() {
  if (!bmp.begin()) 
  {
    Serial.println("BMP085 sensor not found");
    while (1) {}
  }
  pinMode(magneticSensorPin,INPUT_PULLUP); // Magnetic Sensor
  pinMode(pushButtonPin,INPUT_PULLUP); // Push Button
  pinMode(LED_BUILTIN, OUTPUT);     // Initialize the BUILTIN_LED pin as an output
  Serial.begin(115200);
  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
  myservo.attach(servoPin);  // attaches the servo on pin servoPin to the servo object

}

void setup_wifi() {

  delay(10);
  // We start by connecting to a WiFi network
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  for (int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
  }
  payload2Action(payload, length);
}

void payload2Action(byte* payload, unsigned int length){
   char inData[300];

   for(int i = 0; i<length; i++){
    // Serial.print((char)payload[i]);
     inData[(i - 0)] = (char)payload[i];
   }
   StaticJsonBuffer<300> jsonBuffer;
   JsonObject& root = jsonBuffer.parseObject(inData);  

  if (!root.success()) {
      Serial.println("Failed to parse responseBody");
      publish2Reported("error", "true");
    }
  else {
    Serial.println("Shadow JSON: ");
    // Everything published to $aws/things/ArduinoMKR1000/shadow/update/ is redirected to here
    JsonObject& desired = root["desired"];
    for (auto kv : desired) {
      Serial.print(kv.key); Serial.print(": "); Serial.println(kv.value.as<char*>());
      if ((String)kv.key == "toggleLight"){
        Serial.println("Toggle Light Now");
        if ((String)kv.value.as<char*>() == "on"){
            lastServoPosition = onPosition;
            myservo.write(lastServoPosition);
            Serial.println("Light Turned On");
            publish2Reported("toggleLight", "on");
            delay(400);
            myservo.write(middlePos);
        }
        else {
            lastServoPosition = offPosition;
            myservo.write(lastServoPosition);
            Serial.println("Light Turned Off");
            publish2Reported("toggleLight", "off");
            delay(400);
            myservo.write(middlePos);
        }
      }   
      else if ((String)kv.key == "toggleControllerLight"){
        if ((String)kv.value.as<char*>() == "on"){
            digitalWrite(LED_BUILTIN, HIGH);
            Serial.println("Internal Light Turned On");
        }
        else {
            digitalWrite(LED_BUILTIN, LOW); 
            Serial.println("Internal Light Turned Off");
        }
      }
    }
  }
}


void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Attempt to connect
    if (client.connect("MKR1000Client")) {
      Serial.println("connected");
      // Once connected, publish an announcement...
      publish2Reported("connected", "true");
      // Check at all times if the push button is pressed
      turnOnOffByPushButton();
      // ... and resubscribe
      client.subscribe("awsiot_to_localgateway");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      // Wait 5 seconds before retrying
      if (WiFi.status() != WL_CONNECTED) {
          Serial.println("Reconnecting to wifi");
          while (WiFi.status() != WL_CONNECTED) {
            WiFi.begin(ssid, password);
            // Check at all times if the push button is pressed
            turnOnOffByPushButton();
            delay(500);
            Serial.print(".");
          }
      }
      delay(5000);
    }
  }
}

void publish2Reported(String label, String statusUpdate){
    // Initialize the Json Shadow Object (added the thing name to recognize it from others gadgets)
    StaticJsonBuffer<300> JSONbuffer;
    JsonObject& JSONencoder = JSONbuffer.createObject();
    JsonObject& ArduinoMKR1000_1 = JSONencoder.createNestedObject("ArduinoMKR1000_1");
    JsonObject& state = ArduinoMKR1000_1.createNestedObject("state");
    JsonObject& reported = state.createNestedObject("reported");
    char JSONmessageBuffer[300];
    reported[label] = statusUpdate; 
    JSONencoder.printTo(JSONmessageBuffer, sizeof(JSONmessageBuffer));
    Serial.println("Publishing: ");
    Serial.println(JSONmessageBuffer);
    client.publish("localgateway_to_awsiot", JSONmessageBuffer);
}

void turnOnOffByPushButton(){
  while (digitalRead(pushButtonPin) == LOW){
    if (flag == 0){
      if (lastServoPosition == onPosition){
        lastServoPosition = offPosition;
        myservo.write(lastServoPosition);
        publish2Reported("toggleLight", "off");
        delay(400);
        myservo.write(middlePos);
      }
      else {
        lastServoPosition = onPosition;
        myservo.write(lastServoPosition);
        publish2Reported("toggleLight", "on");
        delay(400);
        myservo.write(middlePos);
      }
      flag = 1;
    }  
  }
}

void doorStatusChanged(){
    int doorStatus = digitalRead(magneticSensorPin);
      if (doorStatus == HIGH && flagMag == 0){
        publish2Reported("door", "1");
        flagMag = 1;
      }
      else if (doorStatus == LOW && flagMag == 1){
        publish2Reported("door", "0");
        flagMag = 0;
      }
}

void loop() {

  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  // Check at all times if the push button is pressed
  turnOnOffByPushButton();

  // Check at all times the status of the door
  doorStatusChanged();
  // Every 5 mins report the temperature
  long now = millis();
  if (now - lastMsg1 > 300000) {
    lastMsg1 = now;
    publish2Reported("temperature", String(bmp.readTemperature()));
  }
  // Every Hour report the altitude
  else if (now - lastMsg2 > 3600000) {
    lastMsg2 = now;
    publish2Reported("altitude", String(bmp.readAltitude(101500)));
  }
  flag = 0;
  
}

