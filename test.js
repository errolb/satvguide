#!/usr/bin/env node

;(function() {

  var mongoose = require('mongoose'),
      moment = require('moment'),
      cheerio = require('cheerio'),
      fs = require('fs'),
      util = require('util'),
      colors = require('colors');

  // DB
  var db_address = (function(){
    var db_port = '27017',
        db_name = /*'tvguidedb'*/"testgoose",
        db_base_location  = "mongodb://localhost";
    return db_base_location + ':' + db_port + '/' + db_name;
  })();

  mongoose.connect(db_address);
  var db = mongoose.connection;

  db.on('error', console.error.bind(console, 'connection error:'));

  db.once('open', function () {
    dbOnceOpen();
  });

  function dbOnceOpen() {
    fs.readFile('secret_target', 'utf8', fsOnceFileRead);
  }

  // PRIMARY LOGIC
  function fsOnceFileRead(err, data) {
    if (err) throw err;

    onceTargetsAcquired();
  }

  function onceTargetsAcquired() {

    var TVAPP = (function(){
      this.schema = new mongoose.Schema({
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

      return  { _root: this,
                model: mongoose.model('schedule', this.schema),
                activeData: {},
                logic: {
                  addSchedule: addSchedule
                }
              }
    })();

    // TODO replace fake data
    TVAPP.activeData = {
        channel: "SABC 1",
        date: moment().format("YYYY-MM-DD"),
        days: function(days){
          return moment(this.date).add('days', days).format("YYYY-MM-DD")
        },
        timeslots : [
            {
                time: moment().format("YYYY-MM-DD"),
                title: "McDonnalds document over here, dude",
                mprs: "PG",
                description: "Monkey man lives again.",
                timeslot_id: 1234
            }
        ]
    };

    TVAPP.model.findOne({$and:[{date: {$gte: TVAPP.activeData.date, $lt: TVAPP.activeData.days(1)}},{channel: TVAPP.activeData.channel}]}, function(err, doc) {

        if (err) console.log(err);

        // only add new doc if it doesn't exist.
        if (doc !== null) {
            console.log('document already exists'.blue)
            db.close();
        } else {
            TVAPP.logic.addSchedule();
        }
    });


    function addSchedule() {

      var timeslots = TVAPP.activeData.timeslots;

      //build new db entry
      freshDoc = new TVAPP.model({
          channel: TVAPP.activeData.channel,
          date: TVAPP.activeData.date,
          timeslots : []
      });

      freshDoc.timeslots = timeslots;

      // write new obj to db
      freshDoc.save(function (err) {
          if (err) return console.error(err);
          console.log("write success".rainbow);
          console.log('new object created'.green);
          db.close();
      });
    }

  }
  // /PRIMARY LOGIC

})();
