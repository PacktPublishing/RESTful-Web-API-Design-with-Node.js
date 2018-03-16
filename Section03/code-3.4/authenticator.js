var OAuth = require('oauth').OAuth;
var config = require('./config');

// Create the oauth object for accessing Twitter
var oauth = new OAuth(
	config.request_token_url,
	config.access_token_url,
	config.consumer_key,
	config.consumer_secret,
	config.oauth_version,
	config.oauth_callback,
	config.oauth_signature
);

module.exports = {
	get: function(url, access_token, access_token_secret, cb) {
		oauth.get.call(oauth, url, access_token, access_token_secret, cb);
	},
	post: function(url, access_token, access_token_secret, body, cb) {
		oauth.post.call(oauth, url, access_token, access_token_secret, body, cb);
	},
	redirectToTwitterLoginPage: function(req, res) {
		oauth.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results) {
			if (error) {
				console.log(error);
				res.send("Authentication failed!");
			} else {
				res.cookie('oauth_token', oauth_token, { httpOnly: true });
				res.cookie('oauth_token_secret', oauth_token_secret, { httpOnly: true });
				res.redirect(config.authorize_url + '?oauth_token='+oauth_token);
			}
		});
	},
	authenticate: function(req, res, cb) {
		if (!(req.cookies.oauth_token && req.cookies.oauth_token_secret && req.query.oauth_verifier)) {
			return cb("Request does not have all required keys");
		}

		// Clear the request token data from the cookies
		res.clearCookie('oauth_token');
		res.clearCookie('oauth_token_secret');

		// Exchange oauth_verifier for an access token
		oauth.getOAuthAccessToken(
			req.cookies.oauth_token,
			req.cookies.oauth_token_secret,
			req.query.oauth_verifier,
			function(error, oauth_access_token, oauth_access_token_secret, results) {
				if (error) {
					return cb(error);
				}
				
				// Get the user's Twitter ID
				oauth.get('https://api.twitter.com/1.1/account/verify_credentials.json',
					oauth_access_token, oauth_access_token_secret,
					function(error, data) {
						if (error) {
							console.log(error);
							return cb(error);
						}

						// Parse the JSON response
						data = JSON.parse(data);

						// Store the access token, access token secret, and user's Twitter ID in cookies
						res.cookie('access_token', oauth_access_token, { httpOnly: true });
						res.cookie('access_token_secret', oauth_access_token_secret, { httpOnly: true });
						res.cookie('twitter_id', data.id_str, { httpOnly: true });

						// Tell router that authentication was successful
						cb();
					});
		});
	}
};