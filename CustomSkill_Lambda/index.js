var config = {};
config.IOT_BROKER_ENDPOINT = process.env.endpoint; // also called the REST API endpoint
config.IOT_BROKER_REGION = process.env.region; //"us-east-1"
config.IOT_THING_NAME = process.env.thingName; // Thing name


var Alexa = require('alexa-sdk');

exports.handler = function(event, context, callback) {
	var alexa = Alexa.handler(event, context, callback);
	alexa.registerHandlers(handlers);
    alexa.appId = process.env.alexaAppId;
    alexa.execute();
};

var handlers = {
	'LaunchRequest': function () {
    	this.emit(':ask', 'Welcome to your portable light controller. ' + 'Say help, if you want to learn how to use it.');
	},
    'TemperatureIntent': function () {
        // Get the last stored temperature value from the thing shadow reported
		getShadow(result => {
			this.emit(':tell', 'The current temperature is ' + result.temperature + ' degrees celcius.');
		});
    },
    'AltitudeIntent': function () {
        // Get the last stored temperature value from the thing shadow reported
        getShadow(result => {
            this.emit(':tell', 'The current altitude is ' + result.altitude + ' meters.');
        });
    },
    'DoorStatusIntent': function () {
        // Get the last stored temperature value from the thing shadow reported
        getShadow(result => {
            if (result.door === "0") {
                this.emit(':tell', 'Your door is closed');
            }
            else if (result.door === "1") {
                this.emit(':tell', 'Your door is opened');
            }
            else {
                this.emit(':tell', "Sorry, there was an error and I'm unable to tell the status of the door");
            }  
        });
    },
    'DoorOpenCountIntent': function () {
        var queryString = "SELECT COUNT(*) as DoorOpenCount FROM [portableLightController].[dbo].[ThingShadow] \
                      WHERE[ShadowKey] = 'Door' AND [ShadowAttribute] = '1'";
        
        queryTime = this.event.request.intent.slots.date.value;

        console.log(queryTime);

        queryString = includeTimeInQuery(queryTime, queryString, "");
        
        console.log(queryString);

        getMSSQLData(queryString, queryResult => {

            var DoorOpenCount = queryResult.recordset[0].DoorOpenCount;
            console.log(DoorOpenCount);

            this.emit(':tell', "The door has been opened " + DoorOpenCount + " times, during the requested time.");
        });        
    },
    'PowerConsumptionIntent': function () {
        var queryTime = this.event.request.intent.slots.time.value;
        console.log(queryTime);
        getShadow(result => {
            if (!result.connectedlightbulbs || result.connectedlightbulbs === "?") {
                this.emit(':ask', "Let's setup the power consumption, How many light bulbs does your lamp has?, say, for example, 2 light bulbs.", "Sorry, how many light bulbs?");
            }
            else if (!result.bulbsWattage || result.bulbsWattage === "?") {
                this.emit(':ask', 'Ok, you have' + result.connectedLightBulbs + "light bulbs connected, but I don't know their wattage" + " check on their label, and say for example, 5 watts each, or, say for example, 4 light bulbs, to correct the number of them.", "Sorry, what was the amount of watts?");
            }
            // Consumption since first use
            else if (queryTime == undefined) {
                var query = "select sum(datediff(second, OnTime, OffTime)) / 3600 as HoursOfUse from (select a.[Timestamp] as 'OnTime', \
                    (select MIN(b.[Timestamp]) \
                    FROM[portableLightController].[dbo].[ThingShadow] as b \
                    where b.[ShadowKey] = 'toggleLight' and b.[ShadowAttribute] = 'off' and b.[Timestamp] > a.[Timestamp]) as 'OffTime' \
                    FROM[portableLightController].[dbo].[ThingShadow] as a \
                    where a.[ThingName] = 'ArduinoMKR1000' and a.[ShadowKey] = 'toggleLight' \
                    and a.[ShadowAttribute] = 'on') as HoursOfUse";

                getMSSQLData(query, queryResult => {

                    var hoursOfUse = queryResult.recordset[0].HoursOfUse;
                    console.log(hoursOfUse);

                    var powerConsumed = hoursOfUse * result.connectedlightbulbs * result.bulbsWattage / 1000;

                    // send records as a response
                    this.emit(':tell', "The light has been on for " + hoursOfUse + " hours, that is equivalent to a power consumption of " + powerConsumed + " kilowatts-hour");
                });
            }
            else {
                var queryString = "select sum(datediff(second, OnTime, OffTime)) / 3600 as HoursOfUse from (select a.[Timestamp] as 'OnTime', \
                    (select MIN(b.[Timestamp]) \
                    FROM[portableLightController].[dbo].[ThingShadow] as b \
                    where b.[ShadowKey] = 'toggleLight' and b.[ShadowAttribute] = 'off' and b.[Timestamp] > a.[Timestamp]) as 'OffTime' \
                    FROM[portableLightController].[dbo].[ThingShadow] as a \
                    where a.[ThingName] = 'ArduinoMKR1000' and a.[ShadowKey] = 'toggleLight' \
                    and a.[ShadowAttribute] = 'on'";

                queryString = includeTimeInQuery(queryTime, queryString, "a.");

                queryString += ") as HoursOfUseQuery"

                console.log(queryString);

                getMSSQLData(queryString, queryResult => {

                    var hoursOfUse = queryResult.recordset[0].HoursOfUse;
                    console.log(hoursOfUse);

                    var powerConsumed = hoursOfUse * result.connectedlightbulbs * result.bulbsWattage / 1000;

                    // send records as a response
                    this.emit(':tell', "The light has been on for " + hoursOfUse + " hours, that is equivalent to a power consumption of " + powerConsumed + " kilowatts-hour, during that period of time");
                });
            }
        });
    },
    'LightBulbs': function () {
        var connectedLightBulbs = this.event.request.intent.slots.count.value;
        console.log(connectedLightBulbs);
        var shadowUpdateJSon = {"reported":{"connectedlightbulbs": connectedLightBulbs }};
        console.log(shadowUpdateJSon);
        updateShadow(shadowUpdateJSon, status => {
            this.emit(':ask', 'Ok, you have ' + connectedLightBulbs + ' light bulbs connected.' + ' Now, what is their wattage?, check on their label, and say, for example, 5 watts each.', "Sorry, what was the amount of watts?");
        });
    },
    'Wattage': function () {
        var wattage = this.event.request.intent.slots.number.value;
        console.log(wattage);
        var shadowUpdateJSon = { "reported": { "bulbsWattage": wattage } };
        console.log(shadowUpdateJSon);
        updateShadow(shadowUpdateJSon, status => {
            this.emit(':ask', 'Ok, each one consumes ' + wattage + ' watts.' + ' Now, say the period of time to know the consumption, for example, say, during the last month.', "Sorry, when do you want the power consumption?");
        });
    },
    'AMAZON.HelpIntent': function () {
        this.emit(':ask', 'You can say things like, Alexa, ask my portable controller to tell me the state of the door,  \
             or Alexa, ask my portable controller to tell me, how much electricity has my smart ligth consumed in the last month. ' +
             'If you want to hear more, say tell me more.');
    },
    'TellMeMoreIntent': function () {
        this.emit(':tell', 'You may as well ask, for the amount of times, that your door has been open, during an specific time. Or what is the current temperature, or altitude.');
    },
    'AMAZON.StopIntent': function () {
        this.emit(':responseReady');
    },
    'AMAZON.CancelIntent': function () {
        this.emit(':responseReady');
    },
    'Unhandled': function () {
        this.emit(':ask', "Please, say that again");
    }
};


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
            callback("not ok");
        }
        else {
            console.log("retrieved information from sensor thing shadow");
            var sensorObject = JSON.parse(data.payload).state.reported;
            console.log(sensorObject);
            callback(sensorObject);
        }
    });

}
function updateShadow(state, callback) {
    var AWS = require('aws-sdk');
    AWS.config.region = config.IOT_BROKER_REGION;
    var paramsUpdate = {
        "thingName": config.IOT_THING_NAME,
        "payload": JSON.stringify(
            {
                "state": state
            }
        )
    };
    var iotData = new AWS.IotData({ endpoint: config.IOT_BROKER_ENDPOINT });
    iotData.updateThingShadow(paramsUpdate, function (err, data) {
        if (err) {
            console.log(err);
        }
        else {
            console.log(paramsUpdate.payload);
            callback("Ok");
        }

    });
}
function getMSSQLData(query, callback) {
    var sql = require("mssql");

    // config for your database
    var config = {
        user: process.env.username,
        password: process.env.password,
        server: process.env.server,
        database: 'portableLightController'
    };
    sql.connect(config, function (err) {

        if (err) console.log(err);

        // create Request object
        var request = new sql.Request();

        // query to the database and set the records
        request.query(query, function (err, recordset) {

            if (err) {
                console.log(err);
                callback("Not OK");
            }

            console.log(recordset);

            sql.close();

            callback(recordset);
        });
    });
}

function includeTimeInQuery(queryTime, queryString, tableAlias) {
    // If the time was specified then use it, otherwise get all door open counts
    if (!(queryTime == null)) {
        var year = queryTime.substr(0, 4);
        queryString += " AND YEAR(" + tableAlias + "[Timestamp]) = '" + year + "'";
        if (queryTime.indexOf("W") == -1) { // The user didn't say a week but a correct date
            if (queryTime.length > 4) {
                var month = queryTime.substr(5, 2); // Specific month
                queryString += " AND MONTH(" + tableAlias + "[Timestamp]) = '" + month + "'";
            }
            if (queryTime.length > 7) {
                var day = queryTime.substr(8, 2); // Specific day
                queryString += " AND DAY(" + tableAlias + "[Timestamp]) = '" + day + "'";
            }
        }
        else { // If a week was specified - check amazon.date slot reference
            var week = queryTime.substr(6, 2);
            queryString += " AND DATEPART(WEEK, " + tableAlias + "[Timestamp]) = '" + week + "'";
        }
    }
    return queryString;

}