Slack = require('slack-client');
var request = require('request');
var fuzzy = require('fuzzy');
var config = require('./config.json');

slackToken = config.SLACK_BOT_TOKEN;
carddburl = config.CARD_DB_URL;
autoReconnect = true;
autoMark = true;

function BuildAcronym(name)
{
    var result = "";
    var strings = name.split(" ");
    for(var i = 0; i < strings.length; ++i)
    {
        result += strings[i][0];
    }

    return result;
}

function ProcessCards(body)
{
    var cards = JSON.parse(body);
    cardmap = {};
    cardnames = [];
    acronymMap = {};
    for(var i = 0; i < cards.length; ++i)
    {
        var cardname = cards[i].name;
        // For some reason netrunnerdb is calling the name of the card "title"
        // and thronesdb is calling it name... oh well. Fixing that...
        if(!cardname)
        {
            cardname = cards[i].title;
            cards[i].name = cards[i].title;
        }
        // No need to be be pedantic about casing here Stannis
        // We will still have the name in the object itself
        cardname = cardname.toLowerCase();
        cardmap[cardname] = cards[i];
        var acronym = BuildAcronym(cardname);
        if(acronym && acronym.length > 1)
        {
            acronymMap[acronym] = cards[i];
        }
        cardnames.push(cardname);
    }
    console.log("Built card list!");
}

function FindBestNameMatch(fuzzyname)
{
    var result = {};
    result.exactmatch = false;
    result.card = null;
    var matches = fuzzy.filter(fuzzyname, cardnames);

    // If it's a case, insenstive exact match of a card, obviously return that
    if (fuzzyname in cardmap)
    {
        result.exactmatch = true;
        result.card = cardmap[fuzzyname];
        console.log("Found via case insensitive exact match!")
    }
    else if(fuzzyname in acronymMap)
    {
        result.card = acronymMap[fuzzyname];
        console.log("Found in the acronym map!");
    }
    else if(matches.length > 0)
    {
        result.card = cardmap[matches[0].original];
        console.log("Found via fuzzy search!");
    }

    return result;
}

function ParseMessage(message)
{
    var matches = message.match(/\[.*?\]/g);

    // names from slack message. we will fuzzy match them later
    var matcheswithoutbrackets = [];
    if(matches)
    {
        // pull off the []
        for(var i = 0; i < matches.length; ++i)
        {
            matcheswithoutbrackets.push(matches[i].substring(1, matches[i].length - 1));
        }
    }

    return matcheswithoutbrackets;
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
        var fuzzynames = ParseMessage(message.text.toLowerCase());
        if(fuzzynames)
        {
            var channel = slack.getChannelGroupOrDMByID(message.channel);

            for(var i = 0; i < fuzzynames.length; ++i)
            {
                var response = "";
                var fuzzyname = fuzzynames[i];
                var result = FindBestNameMatch(fuzzyname);
                var card = result.card;
                var exactmatch = result.exactmatch;
                if(card)
                {
                    if (!exactmatch)
                    {
                        response += "I think you mean " + card.name + '\n';
                    }
                    response += carddburl + card.imagesrc;
                }
                else
                {
                    response = fuzzyname + " not found!";
                }     

                if(response.length > 0)
                {
                    channel.send(response);
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