var express = require('express');
var app = express();
var monk = require('monk');
var db = monk('localhost:27017/tvguidedb');
var moment = require('moment');

// Make our db accessible to our router
app.use(function(req,res,next){
    req.db = db;
    next();
});

// ROUTES

// Index
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

// API ROUTES

// all data from a single channel
app.get('/api/tvguide/channel/:arg', function(req, res){
  var db = req.db;

  var channel = req.params.arg;

  var collection = db.get('schedules');
  collection.find({'channel':channel},{},function(e, docs){
      res.send(docs);
  });
});

//all data from a date specific date
app.get('/api/tvguide/day/:arg', function(req, res){
  var db = req.db;
  var day = req.params.arg;
  var collection = db.get('schedules');
  // NOTE: Dates are stored in mongodb as UTC 00:00. Queries should role back 
  // to the preceding day where appropriate, so we have to shift the day over by
  // two hours.
  // The week always starts with today.
  var queryDay = moment().startOf('day').add(day, 'days').subtract(2, 'hours').format()
  var nextDay = moment(queryDay).add(1, 'days').format() 
  collection.find({'date':{$gte: new Date(queryDay), $lt: new Date(nextDay)}},{},function(e, docs){
  //collection.find({'date':{$gte: queryDay, $lt: nextDay}},{},function(e, docs){
          //console.log(fullQuery);
      res.send(docs);
  });
});

// STATIC PATHS
app.use('/public',  express.static(__dirname + '/public'));
app.use('/bower_components',  express.static(__dirname + '/bower_components'));

// ERRORS
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.send(500, 'Something broke!');
});

// SERVER
var server = app.listen(3000, function() {
    console.log('Listening on port %d', server.address().port);
});
