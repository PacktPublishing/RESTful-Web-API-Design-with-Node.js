module.exports = function() {
	var url = require('url');
	var express = require('express');
	var bodyParser = require('body-parser');
	var querystring = require('querystring');
	var async = require('async');
	var authenticator = require('./authenticator');
	var storage = require('./storage.js');
	var config = require('./config');
	var app = express();

	// Connect to MongoDB
	storage.connect();

	// Set the view engine to ejs
	app.set('view engine', 'ejs');

	// Add cookie parsing functionality to our Express app
	app.use(require('cookie-parser')());

	// Parse JSON body and store result in req.body
	app.use(bodyParser.json());

	// Take user to Twitter's login page
	app.get('/auth/twitter', authenticator.redirectToTwitterLoginPage);

	// This is the callback url that the user is redirected to after signing in
	app.get(url.parse(config.oauth_callback).path, function(req, res) {
		authenticator.authenticate(req, res, function(err) {
			if (err) {
				res.redirect('/login');
			} else {
				res.redirect('/');
			}
		});
	});

	// Main page handler
	app.get('/', function(req, res) {
		if (!req.cookies.access_token || !req.cookies.access_token_secret || !req.cookies.twitter_id) {
			return res.redirect('/login');
		}

		// If the app couldn't connect to the database, get data from Twitter's API
		if (!storage.connected()) {
			return renderMainPageFromTwitter(req, res);
		}

		storage.getFriends(req.cookies.twitter_id, function(err, friends) {
			if (err) {
				return res.status(500).send(err);
			}

			if (friends.length > 0) {
				// Sort the friends alphabetically by name
				friends.sort(function(a, b) {
					return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
				});

				// Render the main application
				res.render('index', {
					friends: friends
				});
			} else {
				renderMainPageFromTwitter(req, res);
			}
		});
	});

	function renderMainPageFromTwitter(req, res) {
		async.waterfall([
			// Get friends' IDs
			function(cb) {
				var cursor = -1;
				var ids = [];

				// Get IDs by traversing the cursored collection
				async.whilst(function() {
					return cursor != 0;
				}, function(cb) {
					authenticator.get('https://api.twitter.com/1.1/friends/ids.json?' + querystring.stringify({user_id: req.cookies.twitter_id, cursor: cursor}),
						req.cookies.access_token, req.cookies.access_token_secret,
						function(error, data) {
							if (error) {
								return res.status(400).send(error);
							}

							data = JSON.parse(data);
							cursor = data.next_cursor_str;
							ids = ids.concat(data.ids);

							cb();
						});
				}, function(error) {
					if (error) {
						return res.status(500).send(error);
					}

					cb(null, ids);
				});
			},
			// Get friends' data
			function(ids, cb) {
				// Returns up to 100 ids starting from 100*i
				var getHundredthIds = function(i) {
					return ids.slice(100*i, Math.min(ids.length, 100*(i+1)));
				}
				var requestsNeeded = Math.ceil(ids.length/100);

				async.times(requestsNeeded, function(n, next) {
					var url = 'https://api.twitter.com/1.1/users/lookup.json?' + querystring.stringify({user_id: getHundredthIds(n).join(',')});

					authenticator.get(url,
						req.cookies.access_token, req.cookies.access_token_secret,
						function(error, data) {
							if (error) {
								return res.status(400).send(error);
							}

							var friends = JSON.parse(data);
							next(null, friends);
					});
				},
				function (err, friends) {
					// Flatten friends array
					friends = friends.reduce(function(previousValue, currentValue, currentIndex, array) {
					  return previousValue.concat(currentValue);
					}, []);

					// Sort the friends alphabetically by name
					friends.sort(function(a, b) {
						return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
					});

					// Transform friends into the format that our application needs
					friends = friends.map(function(friend) {
						return {
							twitter_id: friend.id_str,
							for_user: req.cookies.twitter_id,
							name: friend.name,
							location: friend.location,
							profile_image_url: friend.profile_image_url
						};
					});

					// Render the main application
					res.render('index', {
						friends: friends
					});

					// In the background, save the friends to MongoDB
					if (storage.connected()) {
						storage.insertFriends(friends);
					}
				});
			}
		]);
	}

	// Show the login page
	app.get('/login', function(req, res) {
		res.render('login');
	});

	function ensureLoggedIn(req, res, next) {
		if (!req.cookies.access_token || !req.cookies.access_token_secret || !req.cookies.twitter_id) {
			return res.sendStatus(401);
		}

		next();
	}

	// Get notes for a friend
	app.get('/friends/:uid/notes', ensureLoggedIn, function(req, res, next) {
		storage.getNotes(req.cookies.twitter_id, req.params.uid, function(err, notes) {
			if (err) {
				return res.status(500).send(err);
			}

			res.send(notes.map(function(note) {
				return {
					_id: note._id,
					content: note.content
				};
			}));
		});
	});

	// Add a new note to a friend
	app.post('/friends/:uid/notes', ensureLoggedIn, function(req, res) {
		storage.insertNote(req.cookies.twitter_id, req.params.uid, req.body.content,
			function(err, note) {
				if (err) {
					return res.status(500).error(err);
				}

				res.send(note);
			}
		);
	});

	// Update a note
	app.put('/friends/:uid/notes/:noteid', ensureLoggedIn, function(req, res) {
		var noteId = req.params.noteid;

		storage.updateNote(req.params.noteid, req.cookies.twitter_id, req.body.content,
			function(err, note) {
				if (err) {
					return res.status(500).send(err);
				}

				res.send({
					_id: note._id,
					content: note.content
				});
			}
		);
	});

	// Delete a note
	app.delete('/friends/:uid/notes/:noteid', ensureLoggedIn, function(req, res) {
		storage.deleteNote(req.params.noteid, req.cookies.twitter_id, function(err) {
			if (err) {
				return res.status(500).send(err);
			}

			res.sendStatus(200);
		});
	});

	// Serve static files in public directory
	app.use(express.static(__dirname + '/public'));

	// Start listening for requests
	app.listen(config.port, function() {
		console.log("Listening on port " + config.port);
	});
}
