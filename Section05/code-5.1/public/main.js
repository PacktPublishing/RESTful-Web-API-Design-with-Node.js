(function() {
	var selectedUserId;
	var cache = {};

	function startup() {
		var friends = document.getElementsByClassName('friend');
		for (var i = 0; i < friends.length; i++) {
			friends[i].addEventListener('click', function() {
				// Deselect last selected option
				for (var j = 0; j < friends.length; j++) {
					friends[j].className = 'friend';
				}

				// Select friend
				this.className += ' active';

				// Get notes for selected person
				selectedUserId = this.getAttribute('uid');
				var notes = getNotes(selectedUserId, function(notes) {
					var docFragment = document.createDocumentFragment();

					// Add notes
					var notesElements = createNoteElements(notes);
					notesElements.forEach(function(element) {
						docFragment.appendChild(element);
					});

					// Add the new note button
					var newNoteButton = createAddNoteButton();
					docFragment.appendChild(newNoteButton);

					// Render the downloaded notes
					document.getElementById('notes').innerHTML = "";
					document.getElementById('notes').appendChild(docFragment);
				});
			});
		}
	}

	function createNoteElements(notes) {
		return notes.map(function(note) {
			var element = document.createElement('li');
			element.className = "note";
			element.setAttribute('contenteditable', true);
			element.textContent = note.content;
			element.addEventListener('blur', function() {
				note.content = this.textContent;

				if (note.content == "") {
					if (note._id) {
						deleteNote(selectedUserId, note, function() {
							document.getElementById('notes').removeChild(element);
						});
					} else {
						document.getElementById('notes').removeChild(element);
					}
				} else if (!note._id) {
					postNewNote(selectedUserId, {content: this.textContent}, function(newNote) {
						note._id = newNote._id;
					});
				} else {
					putNote(selectedUserId, note, function() {});
				}
			});
			element.addEventListener('keydown', function(e) {
				// If Enter is pressed
				if (e.keyCode == 13) {
					e.preventDefault();

					if (element.nextSibling.className == "add-note") {
						element.nextSibling.click();
					} else {
						element.nextSibling.focus();
					}
				}
			});
			return element;
		});
	}

	function createAddNoteButton() {
		var element = document.createElement('li');
		element.className = "add-note";
		element.textContent = "Add a new note...";
		element.addEventListener('click', function() {
			var noteElement = createNoteElements([{}])[0];
			document.getElementById('notes').insertBefore(noteElement, this);
			noteElement.focus();
		});
		return element;
	}

	function getNotes(userId, callback) {
		if (cache[userId]) {
			return callback(cache[userId]);
		}

		var xhttp = new XMLHttpRequest();
		xhttp.onreadystatechange=function() {
			if (xhttp.readyState == 4 && xhttp.status == 200) {
				var notes = JSON.parse(xhttp.responseText) || [];
				cache[userId] = notes;
				callback(notes);
			}
		};

		xhttp.open("GET", "/friends/" + encodeURIComponent(userId) + "/notes", true);
		xhttp.send();
	}

	function postNewNote(userId, note, callback) {
		var xhttp = new XMLHttpRequest();
		xhttp.onreadystatechange=function() {
			if (xhttp.readyState == 4 && xhttp.status == 200) {
				var serverNote = JSON.parse(xhttp.responseText) || {};
				cache[userId].push(serverNote); // cache[userId] exists because it was created during the GET request.
				callback(serverNote);
			}
		};
		xhttp.open("POST", "/friends/" + encodeURIComponent(userId) + "/notes", true);
		xhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
		xhttp.send(JSON.stringify(note));
	}

	function putNote(userId, note, callback) {
		var xhttp = new XMLHttpRequest();
		xhttp.onreadystatechange=function() {
			if (xhttp.readyState == 4 && xhttp.status == 200) {
				var serverNote = JSON.parse(xhttp.responseText).content || {};
				callback(serverNote);
			}
		};
		xhttp.open("PUT", "/friends/" + encodeURIComponent(userId) + "/notes/" + encodeURIComponent(note._id), true);
		xhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
		xhttp.send(JSON.stringify(note));
	}

	function deleteNote(userId, note, callback) {
		var xhttp = new XMLHttpRequest();
		xhttp.onreadystatechange=function() {
			if (xhttp.readyState == 4 && xhttp.status == 200) {
				cache[userId] = cache[userId].filter(function(localNote) { return localNote._id != note._id; });
				callback();
			}
		};
		xhttp.open("DELETE", "/friends/" + encodeURIComponent(userId) + "/notes/" + encodeURIComponent(note._id), true);
		xhttp.send();
	}

	document.addEventListener('DOMContentLoaded', startup);
})();