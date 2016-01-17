var config = require('../../config.json');
var localcards = require('../../cards.json');
var request = require('request');
var url = require('url');
var fuzzy = require('fuzzy');

var carddburl = config.CARD_DB_URL;
var carddb = function () {};

carddb.cardmap = {};
carddb.cardnames = [];
carddb.acronymMap = {};
var ready = false;

GetCards();

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

carddb.prototype.canHandle = function(message)
{
    return ready && parseMessage(message.toLowerCase()).length > 0;
};

carddb.prototype.buildPost = function (message)
{
    var fuzzynames = parseMessage(message.toLowerCase());
    var response = {};
    response.attachments = [];

    for (var i = 0; i < fuzzynames.length; ++i) {
        var fuzzyname = fuzzynames[i];
        var result = findBestNameMatch(fuzzyname);
        var card = result.card;
        var exactmatch = result.exactmatch;
        if (card) {
            var post = {};
            if(!exactmatch)
            {
                post.pretext = "I think you mean " + card.name + '\n';
            }
            post.title = card.name;
            post.title_link = card.url;
            post.image_url = card.imagesrc;
            post.color = "#000000";
            post.mrkdwn_in = ["text"];
            if (card.use_text) {
                post.text = card.text;
            }
            response.attachments.push(post);
        }
        else {
            response.text = fuzzyname + " not found!";
        }
    }
    return response;
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
