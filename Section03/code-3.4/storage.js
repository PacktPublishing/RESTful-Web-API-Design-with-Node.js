var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
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
	},
	getNotes: function(ownerId, friendId, cb) {
		var cursor = database.collection('notes').find({
			owner_id: ownerId,
			friend_id: friendId
		});

		cursor.toArray(cb);
	},
	insertNote: function(ownerId, friendId, content, cb) {
		database.collection('notes').insert({
			owner_id: ownerId,
			friend_id: friendId,
			content: content
		},
		function(err, result) {
			if (err) {
				return cb(err, result);
			}

			cb(null, {
				_id: result.ops[0]._id,
				content: result.ops[0].content
			});
		});
	},
	updateNote: function(noteId, ownerId, content, cb) {
		database.collection('notes').updateOne({
			_id: new ObjectID(noteId),
			owner_id: ownerId // Used to protect other users' data
		},
		{
			$set: { content: content }
		},
		function(err, result) {
			if (err) {
				return cb(err);
			}

			database.collection('notes').findOne({
				_id: new ObjectID(noteId)
			}, cb);
		});
	},
	deleteNote: function(noteId, ownerId, cb) {
		database.collection('notes').deleteOne({
			_id: new ObjectID(noteId),
			owner_id: ownerId // Used to protect other users' data
		}, cb);
	}
}