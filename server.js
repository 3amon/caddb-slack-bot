var express = require('express');
var request = require('request');
var Sequelize = require('sequelize');
var url = require('url');
var app = express();
var config = require('./config.json');
var carddb = require('./lib/carddb');
var cardmath = require('./lib/cardmathlib');

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({extended: true}));

var msgHandlers = [carddb, cardmath];

function GetBotResponse(message)
{
    var result = {};

    for(var i = 0; i < msgHandlers.length && !result.handled; ++i)
    {
        result = msgHandlers[i].handleMessage(message);
    }

    if (result.post) {
        return result.post;
    }
}

app.get('/thronesbot/oauth/', function (req, res) {
    console.log(req.query);
    request({
        url: 'https://slack.com/api/oauth.access',
        method: 'GET',
        qs: {
            client_id : "4552245108.91769218487",
            client_secret : "5b1c4a4c7d20bd81322a1b7adeec8a06",
            code : req.query.code
        }},
        function(error, response, body){
            console.log(body);
        });
    res.send();
});

app.post('/thronesbot', function (req, res) {

    if (req.body.type == 'event_callback') {
        if(req.body.event.bot_id != 'U3PARD3T9') {
            var response = GetBotResponse(req.body.event.text);
            if (response)
            {
                request({
                        url: 'https://slack.com/api/chat.postMessage',
                        method: 'GET',
                        qs: {
                            token: "xoxb-125365445927-KkbLkr4oGUotkpZrfhJg7Xso",
                            channel: req.body.event.channel,
                            attachments: JSON.stringify(response.attachments),
                            text: response.text,
                            pretty: 1
                        }
                    },
                    function (error, response, body) {
                    });
            }
        }
        res.send();
    }
    else if (req.body.type == 'url_verification') {
        res.send(req.body.challenge);
    }
});

app.listen(3472, function () {
    console.log('Listening on port 3472!');
});