var express = require('express');
var app = express();

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/thronesbot/authorize/', function(req, res) {
  console.log(req);
});

app.post('/thronesbot', function(req, res) {
  res.send(req.body.challenge);
});

app.get('/', function (req, res) {
  res.send('Hello World!');
});

app.listen(3472, function () {
  console.log('Example app listening on port 3000!');
});
