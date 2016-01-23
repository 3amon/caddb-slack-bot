var config = require('../../config.json');
var request = require('request');
var url = require('url');
var fuzzy = require('fuzzy');
var schedule = require('node-schedule');
var fs = require('fs');

var carddburl = config.CARD_DB_URL;
var carddb = function () {};

carddb.cardmap = {};
carddb.cardnames = [];
carddb.acronymMap = {};
var ready = false;

GetCards();
schedule.scheduleJob('00 00 * * *', function(){
    console.log("Getting Cards!");
    GetCards();
} );

function GetCards() {
    request(url.resolve(carddburl, "/api/public/cards"), function (error, response, body) {
        if (!error && response.statusCode == 200) {
            processCards(body);
            ready = true;
        }
        else {
            // For some reason the relative urls are also different... oh well
            request(url.resolve(carddburl, "/api/cards"), function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    processCards(body);
                    ready = true;
                }
            });
        }
    });
}

carddb.prototype.handleMessage = function (message, channelType)
{
    var result = {};

    if(ready) {

        if (parseMessage(message).length > 0) {

            var fuzzynames = parseMessage(message);
            var post = {};
            post.attachments = [];

            for (var i = 0; i < fuzzynames.length; ++i) {
                var fuzzyname = fuzzynames[i].toLowerCase();
                var cardmatch = findBestNameMatch(fuzzyname);
                var card = cardmatch.card;
                var exactmatch = cardmatch.exactmatch;
                if (card) {
                    var attach = {};
                    if (!exactmatch) {
                        attach.pretext = "I think you mean " + card.name + '\n';
                    }
                    attach.title = card.name;
                    attach.title_link = card.url;
                    attach.image_url = card.imagesrc;
                    attach.color = "#000000";
                    attach.mrkdwn_in = ["text"];
                    if (card.use_text) {
                        attach.text = card.text;
                    }
                    post.attachments.push(attach);
                }
                else {
                    post.text = fuzzynames[i] + " not found!";
                }
            }
            result.handled = true;
            result.post = post;
            return result;
        }

        if(channelType == 'DM' && message.toLowerCase() == 'update')
        {
            GetCards();
            result.handled = true;
            return result;
        }
    }

    result.handled = false;
    return result;
};

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

function findBestNameMatch (fuzzyname)
{
    var result = {};
    result.exactmatch = false;
    result.card = null;
    var matches = fuzzy.filter(fuzzyname, carddb.cardnames);

    // If it's a case, insenstive exact match of a card, obviously return that
    if (fuzzyname in carddb.cardmap)
    {
        result.exactmatch = true;
        result.card = carddb.cardmap[fuzzyname];
        console.log("Found via case insensitive exact match!");
    }
    else if(fuzzyname in carddb.acronymMap)
    {
        result.card = carddb.acronymMap[fuzzyname];
        console.log("Found in the acronym map!");
    }
    else if(matches.length > 0)
    {
        result.card = carddb.cardmap[matches[0].original];
        console.log("Found via fuzzy search!");
    }

    return result;
}

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
        carddb.cardmap[cardname] = cards[i];
        var acronym = buildAcronym(cardname);
        if(acronym && acronym.length > 1)
        {
            carddb.acronymMap[acronym] = cards[i];
        }
        carddb.cardnames.push(cardname);
    }
}

function processCards(body)
{
    var localcards = JSON.parse(fs.readFileSync('./cards.json', 'utf8'));
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

module.exports = new carddb();
