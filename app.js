var Slack = require('slack-client');
var config = require('./config.json');
var carddb = require('./lib/carddb');
var cardmath = require('./lib/cardmathlib');

var slack = new Slack(config.SLACK_BOT_TOKEN, true, true);

var msgHandlers = [carddb, cardmath];

slack.on('open', function()
{
    console.log("Connected!");
});

slack.on('message', function(message)
{ 
    if (message.type = 'message' && message.text)
    {
        var post = false;
        var response = {};

        for(var i = 0; i < msgHandlers.length && !post; ++i)
        {
            if(msgHandlers[i].canHandle(message.text))
            {
                response = msgHandlers[i].buildPost(message.text);
                post = true;
            }
        }

        if (post) {
            var channel = slack.getChannelGroupOrDMByID(message.channel);
            response.username = config.BOT_USERNAME;
            response.icon_emoji = config.BOT_EMOJI;
            console.log(response);
            channel.postMessage(response);
        }
    }
});

slack.on('error', function(err)
{
    console.error("Error ", err);
});

slack.login();