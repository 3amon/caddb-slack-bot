var mathlib = function () {};

function factorial (n) {
    var product = 1;
    for ( var j=1; j<=n; j++ )
    {
        product *= j;
    }
    return product;
}

function parseHypergeometricCommand(text)
{
    var text_elems = text.split(' ');
    var params = [];
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

//noinspection JSUnusedLocalSymbols
mathlib.prototype.handleMessage = function (message)
{
    var result = {};
    result.handled = true;

    if(!message.toLowerCase().startsWith('draw'))
    {
        result.handled = false;
        return result;
    }

    var post = {};

    var hyperGParams = parseHypergeometricCommand(message);

    var text = null;

    if(hyperGParams.length < 3)
    {
        text = "Usage:draw *_number_* from *_deck size_* with *_# targets_* hits.\n";
        text += "(Or: draw *_number_* *_deck size_* *_# targets_*)";
        post.text = text;
        result.post = post;
        return result;
    }

    var draw = hyperGParams[0];
    var from = hyperGParams[1];
    var possSuccs = hyperGParams[2];

    var msg = "";
    var cumulative_sum = 0;

    var minSuccs = Math.max(0, draw + possSuccs - from);
    var maxSuccs = Math.min(possSuccs, draw);

    if(maxSuccs < minSuccs)
    {
        text = "Invalid parameters for hypergeometric distribution.";
        post.text = text;
        result.post = post;
        return result;
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

        msg += i + " successes: " + formatPercentage(hypergeomResult);

        //Add a cumulative % on rows beyond the first.
        if(i != 0)
        {
            var cumulativeDescriptor = '' + i + " or more";
            msg += " (" + cumulativeDescriptor + ": " + formatPercentage(1 - cumulative_sum) + ")";
        }
        msg += "\n";
        cumulative_sum += hypergeomResult;
    }

    text = "```" + msg + "```";
    post.text = text;
    result.post = post;
    return result;
};

module.exports = new mathlib();