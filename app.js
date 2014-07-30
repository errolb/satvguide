var express = require('express');
var app = express();
var monk = require('monk');
var db = monk('localhost:27017/tvguidedb');

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

// GET
app.get('/api/tvguide/:arg', function(req, res){
  var db = req.db;

    // NOTE!!: to add dynamic routing. Can't be dumping the whole collection.
    var collection = db.get('scrapedData');
    collection.find({'day': req.params.arg},{},function(e, docs){
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
