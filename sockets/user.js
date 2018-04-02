var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config),
    User = require('../modules/user'),
    Room = require('../modules/room');

// on connection set state
// on disconnection update state

module.exports = function(io, socket, redis, queue) {

    var username = socket.decoded_token.username;

    socket.on('set:master', function(data) {
	User.set(socket, 'master', socket.id);

	User.room(username, function(err, name) {
	    if (err) {
		log.error(err);
		return;
	    }

	    Room(name).get(function(err, room) {
		if (err) {
		    log.error(err);
		    return;
		}

		User.setMaster(io, username);
	    });
	});
    });

    socket.on('token', function(data) {

	data.u = username;

	socket.to(username).emit('token', data);

    });

    socket.on('init', function(data) {
	data = data || {};

	User.join(socket, username, { master: data.master });

	var send = function(err, room) {
	    socket.emit('init', {
		socket: socket.id,
		master: User.get(username, 'master'),
		ua: User.get(username, 'masterUA'),
		room: room,
		username: username,
		sessions: User.get(username, 'users'),
		users: [] //TODO - deprecated
	    });

	    User.sync(socket, username, room);
	};

	User.room(username, function(err, name) {
	    if (err) {
		log.error(err);
		return;
	    }

	    if (name) {
		Room(name).get(send);
	    } else {
		send();
	    }
	});
    });

    socket.on('disconnect', function() {
	// Leave
	if (User.exists(socket.roomdata_room)) User.leave(socket);

	User.room(username, function(err, name) {
	    if (err) {
		log.error(err);
		return;
	    }

	    if (!name) {
		// Update remaining sessions
		if (User.exists(username)) User.sync(socket, username);
		return;
	    }

	    var r = Room(name);

	    // if no user sessions remain - remove user from room
	    if (!User.exists(username)) r.leave(username);
	    else {
		// update user sessions that remain
		r.get(function(err, room) {
		    if (err) {
			log.error(err);
			return;
		    }

		    User.sync(socket, username, room);
		});
	    }

	    r.sync(io, function(err) {
		if (err) log.error(err);
	    });
	});
    });

};
