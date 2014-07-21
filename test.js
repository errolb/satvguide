#!/usr/bin/env node

var mongoose = require('mongoose'),
    moment = require('moment'),
    colors = require('colors');

var db_port             = '27017',
    db_name             = /*'tvguidedb'*/"testgoose",
    db_base_location    = "mongodb://localhost";
var db_address          = db_base_location + ':' + db_port + '/' + db_name;

// console.log(db_address);

mongoose.connect(db_address);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback () {
  interactWidthDB();
});

function interactWidthDB() {

    // Create the Schema
    var tvSchema = new mongoose.Schema({
        channel:  String,
        date: { type: Date },
        timeslots:[{
            time : { type: Date },
            title : String,
            mprs : String,
            description : String,
            timeslot_id : Number
        }]
    });

    // Create the model
    var tvModel = mongoose.model('tvModel', tvSchema);

    /*fake data*/

    activeData = {
        channel: "SABC 1",
        date: moment().format("YYYY-MM-DD"),
        timeslots : [
            {
                time: moment().format("YYYY-MM-DD"),
                title: "McDonnalds docu",
                mprs: "PG",
                description: "Monkey man lives again.",
                timeslot_id: 1234
            }
        ]
    };

    /* /fake data */

    /*find and write data*/
    var dateBegin = moment().format("YYYY-MM-DD");
    var dateEnd = moment().add('days', 1).format("YYYY-MM-DD");

    var channelName = "SABC 1";
    
    tvModel.findOne({$and:[{date: {$gte: dateBegin, $lt: dateEnd}},{channel: channelName}]}, function(err, doc) {
        if (err) console.log(err);
        // console.log(doc);
        // db.close();
        if (doc !== null) {
            createOrUpdate(false, doc);
        } else {
            createOrUpdate(true, doc);
        }
    });
    /* /find and write data*/

    //
    function createOrUpdate(dbEntryIsNew, foundDoc) {
        var timeslots = activeData.timeslots;
        
        if (dbEntryIsNew) {
            
            //build new db entry
            writeModel = new tvModel({
                channel: activeData.channel,
                date: activeData.date,
                timeslots : []
            });

            writeModel.timeslots = timeslots;
            
            // write new obj to db
            writeModel.save(function (err) {
                if (err) return console.error(err);
                console.log("write success".rainbow);
                console.log('new object created'.green);
                db.close();
            });
        } else {
            foundDoc.channel = activeData.channel;
            foundDoc.date = activeData.date;
            foundDoc.timeslots = timeslots;
            foundDoc.save(function(err, doc){
                console.log('object updated'.blue);
                console.log(doc);
                db.close();
            });
        }
    }

    //
}