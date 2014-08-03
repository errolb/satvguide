#!/usr/bin/env node

;(function() {

  var mongoose = require('mongoose'),
      moment = require('moment'),
      cheerio = require('cheerio'),
      fs = require('fs'),
      util = require('util'),
      request = require('request'),
      async = require('async'),
      colors = require('colors');

  // track how many writes to DB.
  var touchDB = 1;
  var testcount = 0;

  // DB
  var db_address = (function(){
    var db_port = '27017',
        db_name = 'tvguidedb',
        db_base_location  = "mongodb://localhost";
    return db_base_location + ':' + db_port + '/' + db_name;
  })();

  mongoose.connect(db_address);
  var db = mongoose.connection;

  // create base objs
  var TVAPP = (function(){
    this.schema = new mongoose.Schema({
        channel:  String,
        date: { type: Date },
        title : String,
        mprs : String,
        description : String,
        datewritten: { type: Date }
    });

    return  { _root: this,
              urls:[],
              model: mongoose.model('schedule', this.schema),
              activeData: [],
              logic: {
                processURL: processURL,
                isAlreadyThere: isAlreadyThere,
                thenFindDocument: thenFindDocument,
                thenAddDocument: thenAddDocument
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

    TVAPP.urls = (function() {
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

    onceurlsAcquired();
  }

  function onceurlsAcquired() {

    // async.map(TVAPP.urls, )

    async.map(TVAPP.urls, TVAPP.logic.);

  }
  // /PRIMARY LOGIC

  function processURL(url, callback) {
    request(url, function(error, response, body) {
      if (!error && response.statusCode == 200) {

        $ = cheerio.load(body.replace(/\s{2,}/g, ""));
        var rootDate = JSON.stringify($("select[name='fDay'] option[selected]").html());
        rootDate = moment(new Date(rootDate)).format().slice(0,11);
        var whichKey = 0;
        var timeslot = {};

        $("table[bgcolor='#999999'] td").each(function(i, elem) {
          // rootDate put here to make sure scraping correct target
          var rootDate = JSON.stringify($("select[name='fDay'] option[selected]").html());
          rootDate = moment(new Date(rootDate)).format().slice(0,11);

          var elemtext = $(elem).text();


          if (i > 5 && $(elem).html() != '<b>&#xA0;</b>') {

            switch(whichKey) {
              case 0:
                timeslot.channel = elemtext.trim();
                whichKey++;
                break;
              case 1:
                timeslot.time = moment(rootDate+elemtext).format();
                whichKey++;
                break;
              case 2:
                timeslot.title = elemtext;
                whichKey++;
                break;
              case 3:
                timeslot.mprs = elemtext;
                whichKey++;
                break;
              case 4:
                timeslot.description = elemtext;
                whichKey++;
                break;
            }

            if (whichKey === 5) {
              // TVAPP.activeData.push({
              //   channel:  timeslot.channel,
              //   date: timeslot.time,
              //   title : timeslot.title,
              //   mprs : timeslot.mprs,
              //   description : timeslot.description
              // });
              callback(timeslot);
              testcount++;
              whichKey = 0;
              timeslot = {};
            }


          }
        });


        // find doc. if not exist, write new.
        // TODO kill DB connection once finnished writing
        // for(o in TVAPP.activeData){
        //   TVAPP.logic.isAlreadyThere(o);
        // }

      }
    });
  }

  function isAlreadyThere(){

    // var findDocumentQueue = async.queue(function(task, callback){
    //     TVAPP.logic.thenFindDocument(task);
    //     callback();
    // }, 5);
    //
    // // this is .async process callback
    // findDocumentQueue.drain = function() {
    //   console.log('all URLs have been processed');
    //   // TVAPP.logic.isAlreadyThere();
    // };
    //
    // //  asign document to queue
    // findDocumentQueue.push(TVAPP.activeData, function (err) {
    //     console.log('finished processing URL');
    // });

    // console.log(TVAPP.activeData.length);

  }

  function thenFindDocument(o) {
    // console.log("this is working");
    TVAPP.model.findOne({$and:[{date: o.date}, {channel: o.channel.trim()}]}, function(err, doc) {

        console.log('checking to see if document is in db');
        if (err) console.log(err);

        // only add new doc if it doesn't exist.
        if (doc !== null) {
            console.log(touchDB + ": " + o.channel + o.date + " already exists".red);
            touchDB++;
        } else {
            TVAPP.logic.thenAddDocument(o);
        }
    });
  }

  function thenAddDocument(o) {

    //build new db entry
    freshDoc = new TVAPP.model({
        channel: o.channel.trim(),
        date: o.date,
        title : o.title,
        mprs : o.mprs,
        description : o.description,
        datewritten : moment().format()
    });

    // write new obj to db
    freshDoc.save(function (err) {
        if (err) return console.error(err);
        console.log(touchDB + ": write success for ".green + o.channel + o.date);
        touchDB++;
    });
  }

})();
