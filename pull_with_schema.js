#!/usr/bin/env node

var request = require('request'),   // http
    cheerio = require('cheerio'),   // html parsing
    fs      = require('fs'),        // filesystem
    colors  = require('colors');    //   colors for debugging

// set DB params
var db_port             = '27017',
    db_name             = 'tvguidedb',
    db_base_location    = "mongodb://localhost";
var db_address          = db_base_location + ':' + db_port + '/' + db_name;

// var db = require('mongo-lite').connect(db_address);
//     db.clear(function(err){
//         if (err) console.log(err);
//     });
//     db.scrapedData = db.collection('scrapedData');

var db = require('mongoose');
db.connect(db_address);


// read secret_target
fs.readFile('secret_target', 'utf8', readSecretFileDone);   

var urls = [];

function readSecretFileDone(err, data){
    if (err) throw err;
    
    urls = generateURLs(data);
    loopRequest(urls);
}

// generate a list of urls to be scraped
function generateURLs(read_file){
    var base_target     =  read_file.toString(),
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
}

function requestDone(scrape_response, url_index, day){
    $ = cheerio.load(scrape_response);
    temp_html = $("table[bgcolor='#999999']").html();
    $ = cheerio.load(temp_html.replace(/\s{2,}/g, ""));

    var dirty_schedule = [];
    $("td").each(function(){
        dirty_schedule.push($(this).text());
    });
    
    var clean_schedule = dirty_schedule.filter(function(v){
        return /\w/.test(v);
    });

    // a clean array of the day's schedule
    clean_schedule = clean_schedule.slice(4,clean_schedule.length);
    
    // create timeslot chunks.
    var time_slot_chunks = [];
    for (var i=0, x=0; i < clean_schedule.length; i=i+5, x++){
        time_slot_chunks.push({
            "channel"       : clean_schedule[i],
            "time"          : clean_schedule[i + 1],
            "title"         : clean_schedule[i + 2],
            "pg"            : clean_schedule[i + 3],
            "description"   : clean_schedule[i + 4]
        });
    }

    // channel's key value, like "sabc1", "sabc2", "etv" etc.
    var channel_name                    = clean_schedule[0].toLowerCase().replace(/ /g,''),
    day_channel_schedule                = {};
    
    day_channel_schedule[channel_name]  = time_slot_chunks;

    populateDB(day_channel_schedule, channel_name, url_index, day);
}


var succesful_writes = 0;

function populateDB(day_channel_schedule, channel_name, url_index, day){

    var data                    = {};
    data[day]                   = {};
    data[day][channel_name]     = day_channel_schedule[channel_name];
    
    var query = {day: day};
    
    db.scrapedData.save(query, function(err, doc){
      doc[day] = data[day]
      db.scrapedData.save(doc, function(err, doc){

        succesful_writes++;
        if (succesful_writes == urls.length) db.close();
        console.log("\n--------------" + succesful_writes + "--------------\n");
      })
    })

}

function loopRequest(urls){
    for (url_index = 0; url_index < urls.length; url_index++) {
        (function(urls, url_index){
            request(urls[url_index], function (error, response, body) {
              if (!error && response.statusCode == 200) {
                var week    = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
                    day     = "";

                switch(true){
                    case url_index < 5:
                        day = week[0];
                        break;
                    case url_index < 10:
                        day = week[1];
                        break;
                    case url_index < 15:
                        day = week[2];
                        break;
                    case url_index < 20:
                        day = week[3];
                        break;
                    case url_index < 25:
                        day = week[4];
                        break;
                    case url_index < 30:
                        day = week[5];
                        break;
                    default:
                        day = week[6];
                }

                requestDone(body, url_index, day);
              }
            });
        })(urls, url_index);
    }
}
