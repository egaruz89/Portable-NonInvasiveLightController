console.log('Loading');

exports.handler = function (event, context, callback) {

    if (event.reported != null) {
        console.log('event = ' + JSON.stringify(event));
        handleWrite2SQL(event, context, callback);
    }
    else {
        console.log('No event object');
    }

    function handleWrite2SQL(event, context, callback) {
        var sql = require("mssql");
        // config for your database
        var config = {
            user: process.env.username,
            password: process.env.password,
            server: process.env.server,
            database: 'portableLightController'
        };
        //console.log(config);

        var reportedShadow = event.reported;

        // connect to your database
        sql.connect(config, function (err) {

            if (err) console.log(err);

            // create Request object
            var request = new sql.Request();

            // get the timestamp
            var timestamp = new Date(Date.now());

            var ThingName = 'ArduinoMKR1000';
            var queryString = "INSERT INTO [portableLightController].[dbo].[ThingShadow] \
                              (Timestamp, ThingName, ShadowKey, ShadowAttribute) VALUES";

            var i = 1; 
            // Add each new reported key, attribute to the query
            for (var key in reportedShadow) {
                var ShadowKey = key;
                var ShadowAttribute = reportedShadow[key];
                // The first set of values doesn't include comma
                if (i == 1) {
                    queryString += "('" + timestamp.toMysqlFormat() + "'  \
                            ,'" + ThingName + "' \
                            ,'" + ShadowKey + "' \
                            ,'" + ShadowAttribute + "')";
                }
                else {
                    queryString += ", ('" + timestamp.toMysqlFormat() + "'  \
                            ,'" + ThingName + "' \
                            ,'" + ShadowKey + "' \
                            ,'" + ShadowAttribute + "')";
                }
                i++;
                  
            }
            // query to the database and set the records
            request.query(queryString, function (err, recordset) {
                    
                    if (err) console.log(err)

                    console.log(recordset);

                    sql.close();

                    context.done(null, 'Success');  // SUCCESS with message
                });
        });
    }
    function twoDigits(d) {
        if (0 <= d && d < 10) return "0" + d.toString();
        if (-10 < d && d < 0) return "-0" + (-1 * d).toString();
        return d.toString();
    }
    Date.prototype.toMysqlFormat = function () {
        return this.getUTCFullYear() + "-" + twoDigits(1 + this.getUTCMonth()) + "-" + twoDigits(this.getUTCDate()) + " " + twoDigits(this.getUTCHours()) + ":" + twoDigits(this.getUTCMinutes()) + ":" + twoDigits(this.getUTCSeconds());
    };

    
};
