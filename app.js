Slack = require('slack-client');
var request = require('request');
var fuzzy = require('fuzzy');
var config = require('./config.json');

slackToken = config.SLACK_BOT_TOKEN;
carddburl = config.CARD_DB_URL;
autoReconnect = true;
autoMark = true;

function ProcessCards(body)
{
    cards = JSON.parse(body);
    cardmap = {};
    cardnames = [];
    for(var i = 0; i < cards.length; ++i)
    {
        // For some reason netrunnerdb is calling the name of the card "title"
        // and thronesdb is calling it name... oh well
        var cardname = cards[i].name;
        if(! cardname)
        {
            cardname = cards[i].title;
        }
        cardmap[cardname] = cards[i];
        cardnames.push(cardname);
    }
    console.log("Built card list!");
}

request(carddburl + "/api/public/cards", function (error, response, body) 
{
    if (!error && response.statusCode == 200) 
    {
        ProcessCards(body);
    }
    else
    {
        // For some reason the relative urls are also different... oh well
        request(carddburl + "/api/cards", function (error, response, body) 
        {
            if (!error && response.statusCode == 200) 
            {
                ProcessCards(body);
            }
        });
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
                    channel.send(carddburl + cardmap[cardname].imagesrc);           
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