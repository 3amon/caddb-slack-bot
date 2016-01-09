Slack = require('slack-client');
var request = require('request');
var fuzzy = require('fuzzy');


slackToken = process.env.SLACK_BOT_THRONESDB_TOKEN;
autoReconnect = true;
autoMark = true;

request('http://thronesdb.com/api/public/cards/', function (error, response, body) {
  if (!error && response.statusCode == 200) {
    cards = JSON.parse(body);
    cardmap = {};
    cardnames = [];
    for(var i = 0; i < cards.length; ++i)
    {
        cardmap[cards[i].name] = cards[i];
        cardnames.push(cards[i].name);
    }
    console.log("Built card list!")
  }
});

slack = new Slack(slackToken, autoReconnect, autoMark);

slack.on('open', function()
{
    console.log("Connected!");
});

slack.on('message', function(message)
{ 
    if (message.type = 'message' && message.text)
    {
        var channel = slack.getChannelGroupOrDMByID(message.channel);
        var matches = message.text.match(/\[.*?\]/g);

        // names from slack message. we will fuzzy match them later
        fuzzynames = [];
        if(matches)
        {
            // pull off the []
            for(var i = 0; i < matches.length; ++i)
            {
                fuzzynames.push(matches[i].substring(1, matches[i].length - 1));
            }
        }

        for(var i = 0; i < fuzzynames.length; ++i)
        {
            fuzzyname = fuzzynames[i];
            matches = fuzzy.filter(fuzzyname, cardnames);
            if(matches.length > 0)
            {
                cardname = matches[0].original;
                if (cardname != fuzzyname)
                {
                    channel.send("I think you mean " + cardname)
                }
                if(cardname in cardmap)
                {
                    channel.send("http://thronesdb.com/" + cardmap[cardname].imagesrc);           
                }
                else
                {
                    console.log(cardname, "not found!");
                }     
            }
        }
   
    }
});

slack.on('error', function(err)
{
    console.error("Error " + err);
});

slack.login();