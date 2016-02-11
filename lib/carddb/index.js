var config = require('../../config.json');
var request = require('request');
var url = require('url');
var fuzzy = require('fuzzy');
var schedule = require('node-schedule');
var Promise = require("bluebird");
var fs = Promise.promisifyAll(require("fs"));

var carddb = function () {};

carddb.cardmap = {};
carddb.acronymMap = {};
var ready = false;

fs.readFileAsync("./cards.json", "utf8").then(function(contents){
    if(contents.length > 0) {
        var filecards = JSON.parse(contents);
        processCards(filecards, null);
    }
    ready = true;
});

function GetCards(carddburl) {
    ready = false;
    request(url.resolve(carddburl, "/api/public/cards"), function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var webcards = JSON.parse(body);
            processCards(webcards, carddburl);
            ready = true;
        }
        else {
            // For some reason the relative urls are also different... oh well
            request(url.resolve(carddburl, "/api/cards"), function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    var webcards = JSON.parse(body);
                    processCards(webcards, carddburl);
                    ready = true;
                }
            });
        }
    });
}

carddb.prototype.handleMessage = function (message, channelType)
{
    var result = {};
    var post = [];
    var usageMsg = {};
    var regexp = {};
    var match = {};
    var card = {};

    if(ready) {

        // Additonal commands. Must be used in a DM
        if(channelType == 'DM')
        {

            if(message.lastIndexOf('update', 0) == 0) {
                post = [];
                usageMsg = "Usage: update  *_card_database_url_*";
                regexp = /update <(.+)(\|.*)?>/g;
                match = regexp.exec(message);
                if(match)
                {
                    var carddburl = match[1];
                    GetCards(carddburl);
                    post.text = "Updating from " + carddburl;
                }
                else
                {
                    post.text = usageMsg;
                }
                result.handled = true;
                result.post = post;
                return result;
            }
            else if (message.lastIndexOf('add', 0) == 0) {
                post = [];
                usageMsg = "Usage: add *_name_*, *_image_url_*, *_\"text\" (optional)_*";
                regexp = /add (.+), <(.+)(\|.*)?>(, "(.+)")?/g;
                match = regexp.exec(message);
                if(match)
                {
                    var name = match[1];
                    var imgUrl = match[2];
                    var text = match[5];
                    card = {};
                    card.name = name;
                    card.imagesrc = imgUrl;
                    if(text) {
                        card.use_text = true;
                        card.text = text;
                    }
                    processCards([card], null);
                    post.text = name + " added.";
                }
                else
                {
                    post.text = usageMsg;
                }
                result.handled = true;
                result.post = post;
                return result;
            }
            else if (message.lastIndexOf('remove', 0) == 0) {
                // TODO
            }
        }

        if (parseMessage(message).length > 0) {

            var fuzzynames = parseMessage(message);
            post.attachments = [];

            for (var i = 0; i < fuzzynames.length; ++i) {
                var fuzzyname = fuzzynames[i].toLowerCase();
                var cardmatch = findBestNameMatch(fuzzyname);
                card = cardmatch.card;
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
    var matches = fuzzy.filter(fuzzyname, Object.keys(carddb.cardmap));

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

        // No need to be be pedantic about caseing here Stannis
        // We will still have the name in the object itself
        cardname = cardname.toLowerCase();
        carddb.cardmap[cardname] = cards[i];
        var acronym = buildAcronym(cardname);
        if(acronym && acronym.length > 1)
        {
            carddb.acronymMap[acronym] = cards[i];
        }
    }

    var newFile = [];
    for (var key in carddb.cardmap) {
        if (carddb.cardmap.hasOwnProperty(key)) {
            newFile.push(carddb.cardmap[key]);
        }
    }

    fs.writeFileAsync("./cards.json", JSON.stringify(newFile)).then(function()
    {
        console.log("Wrote to json file.")
    });
}

function processCards(cards, baseUrl)
{
    // we will fix the urls in webcards
    if(baseUrl) {
        for (var i = 0; i < cards.length; ++i) {
            cards[i].imagesrc = url.resolve(baseUrl, cards[i].imagesrc);
        }
    }

    //addCardsToMap will not override so it will prioritize web cards
    addCardsToMap(cards);

    console.log(cards.length + " cards added.");
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
