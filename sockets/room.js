var config = require('config-api');
var log = require('log')(config.log);
var User = require('../modules/user');
var Room = require('../modules/room');
var async = require('async');

var EXPIRES = 604800;

module.exports = function(io, socket, redis) {

    var username = socket.decoded_token.username;

    socket.on('room:join', function(data) {

	// if already in a room - leave
	User.room(username, function(err, room) {
	    if (err) {
		log.error(err);
		return;
	    }

	    if (room) Room(room).leave(username);
	});

	// create room if it does not exist
	// data:
	//   name
	//   listed
	//   shared
	//   user

	data.username = username;
	var r = Room(data.name);

	async.waterfall([
	    async.apply(r.join.bind(r), data),
	    async.apply(r.sync.bind(r), io)
	], function(err) {
	    if (err) {
		log.error(err);
		return;
	    }

	    // if public bradcast room list
	    //if (data.opts && data.opts.listed) r.broadcast();

	    // broadcast room information
	    async.series({
		vitamin: function(next) {
		    redis.get('r:' + data.name + ':nowplaying', next);
		},

		position: function(next) {
		    redis.get('r:' + data.name + ':nowplaying:position', next);
		},
		queue: function(next) {
		    redis.get('r:' + data.name + ':queue', next);
		}
	    }, function(err, results) {
		if (err) {
		    log.error(err);
		    return;
		}

		io.to(username).emit('player:nowplaying', {
		    nowplaying: JSON.parse(results.vitamin),
		    position: JSON.parse(results.position),
		    room: data.name
		});

		io.to(username).emit('queue', {
		    queue: results.queue ? JSON.parse(results.queue) : []
		});

	    });
	});
    });

    socket.on('room:pause', function(data) {
	User.room(username, function(err, name) {
	    if (err) {
		log.error(err);
		return;
	    }

	    // if user has control broadcast
	    if (name) {
		// get room info to evaluate
		var r = Room(name);
		r.get(function(err, room) {
		    if (err) {
			log.error(err);
			return;
		    }

		    //broadcast if hasControl
		    if (room && (room.shared || room.master === username)) {
			Room(name).usernames(function(err, users) {
			    if (err) {
				log.error(err);
				return;
			    }

			    users.forEach(function(u) {
				socket.broadcast.to(u).emit('room:pause', data);
			    });
			});
		    }
		});
	    }
	});
    });

    socket.on('room:play', function(data) {
	User.room(username, function(err, name) {
	    if (err) {
		log.error(err);
		return;
	    }

	    // if user has control broadcast
	    if (name) {
		// get room info to evaluate
		var r = Room(name);
		r.get(function(err, room) {
		    if (err) {
			log.error(err);
			return;
		    }

		    //broadcast if hasControl
		    if (room && (room.shared || room.master === username)) {
			Room(name).usernames(function(err, users) {
			    if (err) {
				log.error(err);
				return;
			    }

			    users.forEach(function(u) {
				socket.broadcast.to(u).emit('room:play', data);
			    });
			});
		    }
		});
	    }
	});
    });

    socket.on('room:leave', function() {
	User.room(username, function(err, name) {
	    if (err) {
		log.error(err);
		return;
	    }

	    var r = Room(name);

	    // leave room
	    r.leave(username, function(err) {
		if (err) {
		    log.error(err);
		    return;
		}

		User.sync(socket, username, null);

		// destroy room or update any remaining sessions
		r.sync(io, function(err) {
		    if (err) log.error(err);
		});

		redis.get('u:' + username + ':queue', function(err, reply) {
		    if (err) log.error(err);
		    else {
			var data = JSON.parse(reply);
			if (data) {
			    socket.emit('queue', {
				queue: data
			    });
			}
		    }
		});
		
	    });

	});
    });

};
