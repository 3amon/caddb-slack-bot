var express = require('express');
var request = require('request');
var Sequelize = require('sequelize');
var url = require('url');
var app = express();
var carddb = require('./lib/carddb');
var cardmath = require('./lib/cardmathlib');
var secrets = require('./secrets.json');
var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({extended: true}));

var msgHandlers = [carddb, cardmath];

var sequelize = new Sequelize(secrets.POSTGRES_LOGIN);

var Bot = sequelize.define('bot', {
    team_id: Sequelize.STRING,
    bot_access_token: Sequelize.STRING
});

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
    request({
        url: 'https://slack.com/api/oauth.access',
        method: 'GET',
        qs: {
            client_id : secrets.SLACK_CLIENT_ID,
            client_secret : secrets.SLACK_CLIENT_SECRET,
            code : req.query.code
        }},
        function(error, response, body){
            sequelize.sync().then(function() {
                var auth = JSON.parse(body);
                Bot.destroy({
                    where: {
                        team_id: auth.team_id
                    }
                }).then(function() {
                    return Bot.create({
                        bot_access_token: auth.bot.bot_access_token,
                        team_id: auth.team_id
                })})});
        });
    res.send();
});

app.post('/thronesbot', function (req, res) {
    console.log(req.body);
    if (req.body.token == secrets.SLACK_VERIFICATION_TOKEN &&
        req.body.type == 'event_callback') {
        Bot.findOne({
            where: {
                team_id: req.body.team_id
            }
        }).then(function(bot) {
            var response = GetBotResponse(req.body.event.text);
            if (response)
            {
                request({
                        url: 'https://slack.com/api/chat.postMessage',
                        method: 'GET',
                        qs: {
                            token: bot.get('bot_access_token'),
                            channel: req.body.event.channel,
                            attachments: JSON.stringify(response.attachments),
                            text: response.text,
                            pretty: 1
                        }
                    },
                    function (error, response, body) {
                    });
            }
            res.send();
        });
    }
    else if (req.body.type == 'url_verification') {
        res.send(req.body.challenge);
    }
});

app.listen(3472, function () {
    console.log('Listening on port 3472!');
});