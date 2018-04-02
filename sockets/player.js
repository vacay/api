/* global module */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config),
    User = require('../modules/user'),
    Room = require('../modules/room');

var EXPIRES = 604800;

module.exports = function(io, socket, redis) {

    var username = socket.decoded_token.username;

    var hasClients = function() {
	var users = User.get(username, 'users');
	return users && users.length > 1;
    };

    User.room(username, function(err, name) {
	if (err) {
	    log.error(err);
	    return;
	}

	var b = name ? ('r:' + name) : ('u:' + username);

	redis.get(b + ':queue', function(err, reply) {
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

	redis.get(b + ':nowplaying', function(err, reply) {
	    if (err) log.error(err);
	    else {
		var data = JSON.parse(reply);
		if (data) {
		    socket.emit('player:nowplaying', {
			nowplaying: data
		    });
		}
	    }
	});
    });

    redis.get('u:' + username + ':repeat', function(err, reply) {
	if (err) log.error(err);
	else {
	    var data = JSON.parse(reply);
	    if (data) socket.emit('player:repeat', data);
	}
    });

    redis.get('u:' + username + ':autoplay', function(err, reply) {
	if (err) log.error(err);
	else {
	    var data = JSON.parse(reply);
	    if (data) socket.emit('player:autoplay', data);
	}
    });

    redis.get('u:' + username + ':volume', function(err, reply) {
	if (err) log.error(err);
	else {
	    var data = JSON.parse(reply);
	    if (data) socket.emit('player:volume', {
		volume: data
	    });
	}
    });

    socket.on('player:next', function() {
	if (hasClients()) socket.broadcast.to(username).emit('player:next');
    });

    socket.on('player:play', function(data) {
	if (hasClients()) socket.broadcast.to(username).emit('player:play', data);
    });

    socket.on('player:previous', function() {
	if (hasClients) socket.broadcast.to(username).emit('player:previous');
    });

    socket.on('player:history', function(data) {
	if (hasClients) socket.broadcast.to(username).emit('player:history', data);
    });

    socket.on('player:repeat', function(data) {
	redis.set('u:' + username + ':repeat', JSON.stringify(data), function(err) {
	    if (err) log.error(err);
	});
	redis.expire('u:' + username + ':repeat', EXPIRES);

	if (hasClients) socket.broadcast.to(username).emit('player:repeat', data);
    });

    socket.on('player:autoplay', function(data) {
	redis.set('u:' + username + ':autoplay', JSON.stringify(data), function(err) {
	    if (err) log.error(err);
	});
	redis.expire('u:' + username + ':autoplay', EXPIRES);

	if (hasClients()) socket.broadcast.to(username).emit('player:autoplay', data);
    });

    socket.on('player:volume', function(data) {
	redis.set('u:' + username + ':volume', JSON.stringify(data.volume), function(err) {
	    if (err) log.error(err);
	});
	redis.expire('u:' + username + ':volume', EXPIRES);

	if (hasClients()) socket.broadcast.to(username).emit('player:volume', data);
    });

    socket.on('player:status', function(data) {

	User.room(username, function(err, name) {
	    if (err) {
		log.error(err);
		return;
	    }

	    var b = name ? ('r:' + name) : ('u:' + username);

	    // save
	    if (data.time && data.time.position) {
		redis.set(b + ':nowplaying:position', data.time.position, function(err) {
		    if (err) log.error(err);
		});
		redis.expire(b + ':nowplaying:position', EXPIRES);
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
				socket.to(u).emit('player:status', data);
			    });
			});
		    }
		});
	    } else if (hasClients()) {
		socket.broadcast.to(username).emit('player:status', data);
	    }
	});
    });

    socket.on('player:position', function(data) {
	User.room(username, function(err, name) {
	    if (err) {
		log.error(err);
		return;
	    }

	    if (name) {
		// validate room
		var r = Room(name);
		r.exists(function(err, value) {
		    if (err) {
			log.error(err);
			return;
		    }

		    if (!value) return;

		    r.usernames(function(err, users) {
			if (err) {
			    log.error(err);
			    return;
			}

			users.forEach(function(u) {
			    socket.to(u).emit('player:position', data);
			});
		    });
		});
	    } else if (hasClients()) {
		socket.broadcast.to(username).emit('player:position', data);
	    }
	});
    });

    socket.on('queue', function(data) {

	User.room(username, function(err, name) {
	    if (err) {
		log.error(err);
		return;
	    }

	    if (err) {
		log.error(err);
		return;
	    }

	    var b = name ? ('r:' + name) : ('u:' + username);

	    redis.set(b + ':queue', JSON.stringify(data.queue), function(err) {
		if (err) log.error(err);
	    });
	    redis.expire(b + ':queue', EXPIRES);

	    if (name) {
		// validate room
		var r = Room(name);
		r.exists(function(err, value) {
		    if (err) {
			log.error(err);
			return;
		    }

		    if (!value) return;

		    r.usernames(function(err, users) {
			if (err) {
			    log.error(err);
			    return;
			}

			users.forEach(function(u) {
			    socket.broadcast.to(u).emit('queue', data);
			});
		    });
		});
	    } else if (hasClients()) {
		socket.broadcast.to(username).emit('queue', data);
	    }
	});
    });

    socket.on('player:nowplaying', function(data) {

	db.knex('listens').insert({
	    user_id: socket.decoded_token.id,
	    vitamin_id: data.nowplaying.id,
	    created_at: new Date(),
	    ip_address: socket.handshake.query.client_ip || socket.handshake.address.address,
	    user_agent: socket.request.headers['user-agent']
	}).asCallback(function(err, listen) {
	    if (err) log.error(err);
	});

	User.room(username, function(err, name) {
	    if (err) {
		log.error(err);
		return;
	    }

	    var b = name ? ('r:' + name) : ('u:' + username);

	    redis.set(b + ':nowplaying', JSON.stringify(data.nowplaying), function(err) {
		if (err) log.error(err);
	    });
	    redis.expire(b + ':nowplaying', EXPIRES);

	    if (name) {
		var r = Room(name);

		// validate room
		r.exists(function(err, value) {
		    if (err) {
			log.error(err);
			return;
		    }

		    if (!value) return;

		    // broadcast to room sessions
		    r.usernames(function(err, users) {
			if (err) {
			    log.error(err);
			    return;
			}

			users.forEach(function(u) {
			    socket.to(u).emit('player:nowplaying', {
				nowplaying: data.nowplaying,
				room: data.room
			    });
			});
		    });
		});
	    } else if (hasClients()) {
		socket.broadcast.to(username).emit('player:nowplaying', data);
	    }
	});
    });
};
