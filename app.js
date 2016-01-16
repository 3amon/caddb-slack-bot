var Slack = require('slack-client');
var request = require('request');
var fuzzy = require('fuzzy');
var config = require('./config.json');
var url = require('url');
var localcards = require('./cards.json');

slackToken = config.SLACK_BOT_TOKEN;
carddburl = config.CARD_DB_URL;
autoReconnect = true;
autoMark = true;

function buildAcronym(name)
{
    var result = "";
    var strings = name.split(" ");
    for(var i = 0; i < strings.length; ++i)
    {
        result += strings[i][0];
    }

    return result;
}

cardmap = {};
cardnames = [];
acronymMap = {};

function addCardsToMap(cards)
{
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
        var acronym = buildAcronym(cardname);
        if(acronym && acronym.length > 1)
        {
            acronymMap[acronym] = cards[i];
        }
        cardnames.push(cardname);
    }
}

function processCards(body)
{
    var webcards = JSON.parse(body);

    console.log(localcards.length + " local cards added.");

    // we will fix the urls in webcards
    for(var i = 0; i < webcards.length; ++ i)
    {
        webcards[i].imagesrc = url.resolve(carddburl, webcards[i].imagesrc);
    }

    //addCardsToMap will not override so it will prioritize web cards
    addCardsToMap(webcards);
    addCardsToMap(localcards);

    console.log("Built card list!");
}

function findBestNameMatch(fuzzyname)
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

function parseMessage(message)
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

function parseHypergeometricCommand(text)
{
    text_elems = text.split(' ');
    params = [];
    for(var i = 0; i < text_elems.length; ++i)
    {
        var int_val = parseInt(text_elems[i], 10);
        if(!isNaN(int_val))
        {
            params.push(int_val)
        }
    }
    return params;
}

function factorial (n) {
    var product = 1;
    for ( var j=1; j<=n; j++ )
    {
        product *= j;
    }
    return product;
}

function binomialCoeff(a,b) {
    var a_fac = factorial(a);
    var b_fac = factorial(b);
    var diff_fac = factorial(a-b);

    return a_fac/(b_fac*diff_fac);
}

function formatPercentage(val) {
    return (val * 100).toPrecision(3).substring(0,4) + "%"
}

//Chance of getting "succs" successes, when drawing "draws" from a population of "popSize" 
//and "possSuccs" successes in population
function hypergeometric(succs, draws, popSize, possSuccs) {
    return binomialCoeff(possSuccs, succs) * binomialCoeff(popSize - possSuccs, draws- succs) / binomialCoeff(popSize, draws)
}

function buildHypergeometricMessage(message, response)
{
    var hyperGParams = parseHypergeometricCommand(message.text);

    if(hyperGParams.length < 3)
    {
        response.text = "Usage:draw *_number_* from *_deck size_* with *_# targets_* hits.\n";
        response.text += "(Or: draw *_number_* *_deck size_* *_# targets_*)";
        return;
    }

    var draw = hyperGParams[0];
    var from = hyperGParams[1];
    var possSuccs = hyperGParams[2]

    var msg = ""
    var cumulative_sum = 0;

    var minSuccs = Math.max(0, draw + possSuccs - from)
    var maxSuccs = Math.min(possSuccs, draw);

    if(maxSuccs < minSuccs)
    {
        response.text = "Invalid parameters for hypergeometric distribution.";
        return
    }
    for(var i = 0; i <= possSuccs && i < 5; ++i)
    {
        var hypergeomResult;

        //Check our conditions for seeing a reasonable result
        if(i < minSuccs || i > maxSuccs)
        {
            hypergeomResult = 0;
        }
        else
        {
           hypergeomResult = hypergeometric(i, draw, from, possSuccs);
        }

        msg += i + " successes: " + formatPercentage(hypergeomResult)

        //Add a cumulative % on rows beyond the first.
        if(i != 0)
        {
            var cumulativeDescriptor = '' + i + " or more";
            msg += " (" + cumulativeDescriptor + ": " + formatPercentage(1 - cumulative_sum) + ")";
        }
        msg += "\n"
        cumulative_sum += hypergeomResult;
    }

    response.text = "```" + msg + "```";
}

function buildPost(card, exactmatch)
{
    var post = {};
    if (!exactmatch)
    {
        post.pretext = "I think you mean " + card.name + '\n';
    }
    post.title = card.name;
    post.title_link = card.url;
    post.image_url = card.imagesrc;
    post.color = "#000000";
    post.mrkdwn_in = ["text"];
    if(card.use_text)
    {
        post.text = card.text;
    }
    return post;
}

request(url.resolve(carddburl, "/api/public/cards"), function (error, response, body)
{
    if (!error && response.statusCode == 200) 
    {
        processCards(body);
    }
    else
    {
        // For some reason the relative urls are also different... oh well
        request(url.resolve(carddburl, "/api/cards"), function (error, response, body)
        {
            if (!error && response.statusCode == 200) 
            {
                processCards(body);
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
        var fuzzynames = parseMessage(message.text.toLowerCase());

        var response = {};
        response.username = config.BOT_USERNAME;
        response.icon_emoji = config.BOT_EMOJI;
        if(message.text.startsWith('draw'))
        {
            var channel = slack.getChannelGroupOrDMByID(message.channel);
            buildHypergeometricMessage(message, response)

            if(response)
            {
                channel.postMessage(response);
            }
        }
        else if(fuzzynames)
        {
            var channel = slack.getChannelGroupOrDMByID(message.channel);

            for(var i = 0; i < fuzzynames.length; ++i)
            {
               
                var fuzzyname = fuzzynames[i];
                var result = findBestNameMatch(fuzzyname);
                var card = result.card;
                var exactmatch = result.exactmatch;
                if(card)
                {
                    response.attachments = [];
                    var post = buildPost(card, exactmatch);
                    response.attachments = [post];
                }
                else
                {
                    response.text = fuzzyname + " not found!";
                }

                if(response)
                {
                    console.log(response);
                    channel.postMessage(response);
                } 
            }
        }
    }
});

slack.on('error', function(err)
{
    console.error("Error ", err);
});

slack.login();