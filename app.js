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
        var result = {};

        for(var i = 0; i < msgHandlers.length && !result.handled; ++i)
        {
            result = msgHandlers[i].handleMessage(message.text, message.getChannelType());
        }

        if(result.handled)
        {
            console.log(result);
        }

        if (result.post) {
            var channel = slack.getChannelGroupOrDMByID(message.channel);
            result.post.username = config.BOT_USERNAME;
            result.post.icon_emoji = config.BOT_EMOJI;
            channel.postMessage(result.post);
        }
    }
});

slack.on('error', function(err)
{
    console.error("Error ", err);
});

slack.login();