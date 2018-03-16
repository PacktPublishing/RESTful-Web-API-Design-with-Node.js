var express = require('express');

var app = express();
var v1 = express.Router();
var v2 = express.Router();

v1.get('/hello', function(req, res) {
	res.send("Hello from v1");
});

v2.get('/hello', function(req, res) {
	res.send("Hello from v2");
});

app.use('/v1', v1);
app.use('/v2', v2);

app.listen(8080, function() {
	console.log("Listening on port 8080");
});
