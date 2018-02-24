var config = {};
config.IOT_BROKER_ENDPOINT = process.env.endpoint; // also called the REST API endpoint
config.IOT_BROKER_REGION = process.env.region; //"us-east-1"
config.IOT_THING_NAME = process.env.thingName; // Thing name


exports.handler = function (request, context, callback) {
    if (request.directive.header.namespace === 'Alexa.Discovery' && request.directive.header.name === 'Discover') {
        log("DEBUG:", "Discover request",  JSON.stringify(request));
        handleDiscovery(request, context, callback);
    }
    else if (request.directive.header.namespace === 'Alexa.PowerController') {
        if (request.directive.header.name === 'TurnOn' || request.directive.header.name === 'TurnOff') {
            log("DEBUG:", "TurnOn or TurnOff Request", JSON.stringify(request));
            handlePowerControl(request, context, callback);
        }
    }
    else if (request.directive.header.namespace === 'Alexa') {
        if (request.directive.header.name === 'ReportState'){
            handleTemperatureRequest(request, context, callback);
        }
    }

    function handleDiscovery(request, context, callback) {
        var payload = {
            "endpoints":
            [
                {
                    "endpointId": config.IOT_THING_NAME,
                    "manufacturerName": "Smart Device Company",
                    "friendlyName": "Smart Light",
                    "description": "Smart Device Switch",
                    "displayCategories": ["SWITCH"],
                    "cookie": {
                        "key1": "arbitrary key/value pairs for skill to reference this endpoint.",
                        "key2": "There can be multiple entries",
                        "key3": "but they should only be used for reference purposes.",
                        "key4": "This is not a suitable place to maintain current endpoint state."
                    },
                    "capabilities":
                    [
                        {
                          "type": "AlexaInterface",
                          "interface": "Alexa",
                          "version": "3"
                        },
                        {
                            "interface": "Alexa.PowerController",
                            "version": "3",
                            "type": "AlexaInterface",
                            "properties": {
                                "supported": [{
                                    "name": "powerState"
                                }],
                                 "retrievable": true
                            }
                        },
						{
                            "interface": "Alexa.TemperatureSensor",
                            "version": "3",
                            "type": "AlexaInterface",
                            "properties": {
                                "supported": [{
                                    "name": "temperature"
                                }],
                                "proactivelyReported": true,
                                "retrievable": true
                            }
                        }
                    ]
                }
            ]
        };
        var header = request.directive.header;
        header.name = "Discover.Response";
        log("DEBUG", "Discovery Response: ", JSON.stringify({ header: header, payload: payload }));
        context.succeed({ event: { header: header, payload: payload } });
    }

    function log(message, message1, message2) {
        console.log(message + message1 + message2);
    }

    function handlePowerControl(request, context, callback) {
		
        // get device ID passed in during discovery
        var requestMethod = request.directive.header.name;
        
        var requestEndpointID = request.directive.endpoint.endpointId;
        // get user token pass in request
        //var requestToken = request.directive.payload.scope.token;


        if (requestMethod === "TurnOn") {

            // Make the call to your device cloud for control 
            // powerResult = stubControlFunctionToYourCloud(endpointId, token, request);
            updateShadow("on", function(status) {
                console.log(status)
            });
			
        }
        else if (requestMethod === "TurnOff") {
            // Make the call to your device cloud for control and check for success 
            // powerResult = stubControlFunctionToYourCloud(endpointId, token, request);
            updateShadow("off", function(status) {
                console.log(status);
            });
        }
		
		var shadowData;
		getShadow(result => {
            shadowData = result;
            console.log(shadowData);
            var event = new Date(Date.now());
            console.log(event);
            var response = {
                "context": {
                    "properties": [
                        {
                            "namespace": "Alexa.PowerController",
                            "name": "powerState",
                            "value": shadowData.state.reported.toggleLight,
                            "timeOfSample": event.toISOString(),
                            "uncertaintyInMilliseconds": 500
                        }
                    ]
                },
                "event": {
                    "header": {
                        "namespace": "Alexa",
                        "name": "Response",
                        "payloadVersion": "3",
                        "messageId": "5f8a426e-01e4-4cc9-8b79-65f8bd0fd8a4",
                        "correlationToken": request.directive.header.correlationToken
                    },
                    "endpoint": {
                        "scope": {
                            "type": "BearerToken",
                            "token": "access-token-from-Amazon"
                        },
                        "endpointId": requestEndpointID
                    },
                    "payload": {}
                }
    		}
            context.succeed(response);
    	});
		
        
    }
	function handleTemperatureRequest(request, context, callback) {
	
	    var requestEndpointID = request.directive.endpoint.endpointId;
	    
	    var shadowData;
		getShadow(result => {
            shadowData = result;
            console.log(shadowData);
            var event = new Date(Date.now());
            console.log(event);
            var response = {
              "context": {
                "properties": [ {
                  "namespace": "Alexa.TemperatureSensor",
                  "name": "temperature",
                  "value": {
                    "value": shadowData.state.reported.temperature,
                    "scale": "CELSIUS"
                  },
                  "timeOfSample": event.toISOString(),
                  "uncertaintyInMilliseconds": 1000
                } ]
              },
              "event": {
                "header": {
                  "namespace": "Alexa",
                  "name": "StateReport",
                  "payloadVersion": "3",
                  "messageId": "5f8a426e-01e4-4cc9-8b79-65f8bd0fd8a4",
                  "correlationToken": request.directive.header.correlationToken
                },
                "endpoint": {
                  "endpointId": requestEndpointID
                },
                "payload": {}
              }
            }
	        context.succeed(response);
		});
	}
	
};

function updateShadow(desiredState, callback) {
		// update AWS IOT thing shadow
		var AWS = require('aws-sdk');
		AWS.config.region = config.IOT_BROKER_REGION;

		//Prepare the parameters of the update call

		var paramsUpdate = {
			"thingName" : config.IOT_THING_NAME,
			"payload" : JSON.stringify({ 
			    "state":{
				    "desired":{ 
				        "toggleLight": desiredState     
					    }
				    }
			})
		};

		var iotData = new AWS.IotData({endpoint: config.IOT_BROKER_ENDPOINT});

		iotData.updateThingShadow(paramsUpdate, function(err, data)  {
			if (err){
				console.log(err);
				callback("update failed");
			}
			else {
				console.log("updated thing shadow " + paramsUpdate.payload);
				callback("ok");
			}

		});
	}
	function getShadow(callback) {
		// update AWS IOT thing shadow
		var AWS = require('aws-sdk');
		AWS.config.region = config.IOT_BROKER_REGION;

		//Prepare the parameters of the update call

		var iotData = new AWS.IotData({endpoint: config.IOT_BROKER_ENDPOINT});

		var paramsGet = {
			thingName: config.IOT_THING_NAME /* required */
		};

		iotData.getThingShadow(paramsGet, function(err, data)  {
			if (err){
				console.log(err);
				callback("get failed");
			}
			else {
				console.log("retrieved information from sensor thing shadow");
				var sensorObject = JSON.parse(data.payload);
				callback(sensorObject);

			}

		});

	}