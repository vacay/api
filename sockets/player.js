/* global module */

var config = require('config-api'),
    log = require('log')(config.log);

var EXPIRES = 604800;

module.exports = function(io, socket, redis) {

    var user = socket.decoded_token.username;
    var clients, master;

    socket.join(user, function(err) {
	if (err) log.error(err);

	var resetMaster = function() {
	    var data = {
		css: 'paused',
		playing: false
	    };

	    redis.set(user + ':css', JSON.stringify(data));
	    redis.expire(user + ':css', EXPIRES);
	    socket.to(user).emit('player:stop');
	    socket.to(user).emit('player:css:update', data);
	    socket.to(user).emit('player:loading:update', {
		loading: {
		    width: '0%'
		}
	    });
	    socket.to(user).emit('player:position:update', {
		position: {
		    width: '0%'
		}
	    });
	};

	clients = Object.keys(io.nsps['/'].adapter.rooms[user]);
	master = clients[0];

	socket.on('set:master', function() {
	    resetMaster();
	    master = socket.id;
	    socket.broadcast.to(user).emit('remote');
	});

	socket.on('disconnect', function() {
	    if (master === socket.id) {
		clients = Object.keys(io.nsps['/'].adapter.rooms[user]);
		resetMaster();
		master = clients[0];
		socket.to(master).emit('master');
	    }
	});

	socket.on('init:player', function(data) {
	    socket.emit(master === socket.id ? 'master' : 'remote');
	});

	redis.get(user + ':queue', function(err, reply) {
	    if (err) log.error(err);
	    else {
		var data = JSON.parse(reply);
		if (data) {
		    socket.emit('queue:update', {
			queue: data
		    });
		}
	    }
	});

	redis.get(user + ':nowplaying', function(err, reply) {
	    if (err) log.error(err);
	    else {
		var data = JSON.parse(reply);
		if (data) {
		    socket.emit('player:nowplaying:update', {
			nowplaying: data
		    });
		}
	    }
	});

	redis.get(user + ':css', function(err, reply) {
	    if (err) log.error(err);
	    else {
		var data = JSON.parse(reply);
		if (data) socket.emit('player:css:update', data);
	    }
	});

	redis.get(user + ':volume', function(err, reply) {
	    if (err) log.error(err);
	    else {
		var data = JSON.parse(reply);
		if (data) socket.emit('player:volume', {
		    volume: data
		});
	    }
	});
	
	if (clients.length > 1) {

	    socket.on('player:next', function() {
		socket.to(user).emit('player:next');
	    });

	    socket.on('player:play', function(data) {
		socket.to(user).emit('player:play', data);
	    });

	    socket.on('player:previous', function() {
		socket.to(user).emit('player:previous');
	    });

	    socket.on('player:position:update', function(data) {
		log.debug(data);

		socket.to(user).emit('player:position:update', data);
	    });

	    socket.on('player:loading:update', function(data) {
		log.debug(data);

		socket.to(user).emit('player:loading:update', data);
	    });

	    socket.on('player:time:update', function(data) {
		log.debug(data);

		socket.to(user).emit('player:time:update', data);
	    });


	}

	socket.on('player:css:update', function(data) {
	    log.debug(data);

	    redis.set(user + ':css', JSON.stringify(data));
	    redis.expire(user + ':css', EXPIRES);

	    socket.to(user).emit('player:css:update', data);
	});

	socket.on('queue:update', function(data) {
	    log.debug(data);

	    redis.set(user + ':queue', JSON.stringify(data.queue));
	    redis.expire(user + ':queue', EXPIRES);

	    socket.to(user).emit('queue:update', data);
	});

	socket.on('player:nowplaying:update', function(data) {
	    log.debug(data);

	    redis.set(user + ':nowplaying', JSON.stringify(data.nowplaying));
	    redis.expire(user + ':nowplaying', EXPIRES);

	    socket.broadcast.emit('vitamin:play', data.nowplaying);
	    socket.to(user).emit('player:nowplaying:update', data);
	});

	socket.on('player:volume', function(data) {
	    redis.set(user + ':volume', JSON.stringify(data.volume));
	    redis.expire(user + ':volume', EXPIRES);

	    socket.to(user).emit('player:volume', data);
	});

    });
};
