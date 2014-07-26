#!/usr/bin/env node

;(function() {

  var mongoose = require('mongoose'),
      moment = require('moment'),
      cheerio = require('cheerio'),
      fs = require('fs'),
      util = require('util'),
      request = require('request'),
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

  // create base obj
  var TVAPP = (function(){
    this.schema = new mongoose.Schema({
        channel:  String,
        date: { type: Date },
        timeslots:[{
            time : { type: Date },
            title : String,
            mprs : String,
            description : String,
            timeslot_id : String
        }]
    });

    return  { _root: this,
              targets:[],
              model: mongoose.model('schedule', this.schema),
              activeData: {},
              logic: {
                addDocument: addDocument
              }
            }
  })();

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

    TVAPP.targets = (function() {
      var base_target     =  data.toString(),
          submit_key      = "fSubmit",
          day_key         = "fDay",
          channel_name    = "fChannel";

      var submit_value    = 1,
          week            = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
          channel_value   = [1,2,3,4,5];

      var urls = [];

      for (day in week) {
          for (channel in channel_value){
              var full_target = base_target   +   "?"
                              + submit_key    +   "=" +   submit_value    + "&"
                              + day_key       +   "=" +   week[day]       + "&"
                              + channel_name  +   "=" +   channel_value[channel];
              urls.push(full_target);
          }
      }

      return urls;
    })();

    onceTargetsAcquired();
  }

  function onceTargetsAcquired() {

    // begin scraping
    request(TVAPP.targets[0], function(error, response, body) {
      if (!error && response.statusCode == 200) {

        $ = cheerio.load(body.replace(/\s{2,}/g, ""));
        var whichKey = 0;
        var timeslot = {};


        // traversal and assignment. building active data
        TVAPP.activeData = (function() {

          return {
            // _root: this,
            channel: $("select[name='fChannel'] option[selected]").html(),
            date: moment( new Date($("select[name='fDay'] option[selected]").html())).format(),
            daysFromNow: function(days) {
              return moment(this.date).add('days', days).format()
            },
            timeslots: []
          }
        })();

        // build timeslots
        $("table[bgcolor='#999999'] td").each(function(i, elem) {
          var elemtext = $(elem).text();

          if (i > 5 && $(elem).html() != '<b>&#xA0;</b>') {

            switch(whichKey) {
              case 0:
                timeslot.channel = elemtext;
                whichKey++;
                break;
              case 1:
                timeslot.time = moment(TVAPP.activeData.date.slice(0,11) + elemtext + ':00').format();
                whichKey++;
                break;
              case 2:
                timeslot.title = elemtext;
                whichKey++;
                break;
              case 3:
                timeslot.msrp = elemtext;
                whichKey++;
                break;
              case 4:
                timeslot.description = elemtext;
                whichKey++;
                break;
            }

            if (whichKey === 5) {
              TVAPP.activeData.timeslots.push(timeslot);
              whichKey = 0;
              timeslot = {};
            }
          }
        });


        // update db here
        TVAPP.model.findOne({$and:[{date: {$gte: TVAPP.activeData.date, $lt: TVAPP.activeData.daysFromNow(1)}},{channel: TVAPP.activeData.channel}]}, function(err, doc) {

            if (err) console.log(err);

            // only add new doc if it doesn't exist.
            if (doc !== null) {
                console.log('document already exists'.blue)
                db.close();
            } else {
                TVAPP.logic.addDocument();
            }
        });


      }
    });


  }
  // /PRIMARY LOGIC

  function addDocument() {

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

})();
