var Slack = require('slack-client');
var config = require('./config.json');
var carddb = require('./lib/carddb');
var cardmath = require('./lib/cardmathlib');

slack = new Slack(config.SLACK_BOT_TOKEN, true, true);

slack.on('open', function()
{
    console.log("Connected!");
});

slack.on('message', function(message)
{ 
    if (message.type = 'message' && message.text)
    {
        var response = {};

        if(message.text.startsWith('draw'))
        {
            response.text = cardmath.buildHypergeometricMessage(message);
            response.post = true;
        }
        else
        {
            var fuzzynames = carddb.parseMessage(message.text.toLowerCase());
            if (fuzzynames)
            {
                for (var i = 0; i < fuzzynames.length; ++i) {
                    var fuzzyname = fuzzynames[i];
                    var result = carddb.findBestNameMatch(fuzzyname);
                    var card = result.card;
                    var exactmatch = result.exactmatch;
                    if (card) {
                        response.attachments = [];
                        var post = carddb.buildPost(card, exactmatch);
                        response.attachments = [post];
                    }
                    else {
                        response.text = fuzzyname + " not found!";
                    }
                    response.post = true;
                }
            }
        }

        if (response.post) {
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