var MongoClient = require('mongodb').MongoClient;
var database;

module.exports = {
	connect: function() {
		MongoClient.connect('mongodb://localhost:27017/twitter_notes', function(err, db) {
			if (err) {
				return console.log("Error: " + err);
			}

			db.open(function(err, db) {
				database = db;
				console.log("Connected to database.");
			});
		});
	},
	connected: function() {
		return typeof database != 'undefined';
	},
	getFriends: function(userId, cb) {
		var cursor = database.collection('friends').find({
			for_user: userId
		});

		cursor.toArray(cb);
	},
	insertFriends: function(friends) {
		database.collection('friends').insert(friends, function(err) {
			if (err) {
				console.log("Cannot insert friends to database.");
			}
		});
	}
}