/* global module */

var config = require('config-api'),
    log = require('log')(config.log),
    redis = require('redis');

var client = redis.createClient(config.redis.port, config.redis.host, {
    auth_pass: config.redis.auth_pass
});

var EXPIRES = 604800;

module.exports = function(io, socket) {

    var user = socket.decoded_token.username;

    socket.join(user, function(err) {
	if (err) log.error(err);

	var clients = Object.keys(io.nsps['/'].adapter.rooms[user]);
	var count = clients.length;
	var master = clients[0];

	socket.on('disconnect', function() {
	    clients = Object.keys(io.nsps['/'].adapter.rooms[user]);

	    if (master !== clients[0]) {
		var data = {
		    css: 'paused',
		    playing: false
		};

		client.set(user + ':css', JSON.stringify(data));
		client.expire(user + ':css', EXPIRES);

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
	    }

	    master = clients[0];
	    socket.to(master).emit('master');
	});

	socket.emit(count === 1 ? 'master' : 'remote');

	client.get(user + ':queue', function(err, reply) {
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

	client.get(user + ':nowplaying', function(err, reply) {
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

	client.get(user + ':css', function(err, reply) {
	    if (err) log.error(err);
	    else {
		var data = JSON.parse(reply);
		if (data) socket.emit('player:css:update', data);
	    }
	});

	client.get(user + ':volume', function(err, reply) {
	    if (err) log.error(err);
	    else {
		var data = JSON.parse(reply);
		if (data) socket.emit('player:volume', {
		    volume: data
		});
	    }
	});


	if (count > 1) {

	    socket.on('player:next', function() {
		socket.to(user).emit('player:next');
	    });

	    socket.on('player:play', function(data) {
		socket.to(user).emit('player:play', data);
	    });

	    socket.on('player:previous', function() {
		socket.to(user).emit('player:previous');
	    });

	    socket.on('player:volume', function(data) {
		client.set(user + ':volume', JSON.stringify(data.volume));
		client.expire(user + ':volume', EXPIRES);

		socket.to(user).emit('player:volume', data);
	    });

	    socket.on('player:css:update', function(data) {
		log.debug(data);

		client.set(user + ':css', JSON.stringify(data));
		client.expire(user + ':css', EXPIRES);

		socket.to(user).emit('player:css:update', data);
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

	    socket.on('player:nowplaying:update', function(data) {
		log.debug(data);

		client.set(user + ':nowplaying', JSON.stringify(data.nowplaying));
		client.expire(user + ':nowplaying', EXPIRES);

		socket.broadcast.emit('vitamin:play', data.nowplaying);
		socket.to(user).emit('player:nowplaying:update', data);
	    });

	    socket.on('queue:update', function(data) {
		log.debug(data);

		client.set(user + ':queue', JSON.stringify(data.queue));
		client.expire(user + ':queue', EXPIRES);

		socket.to(user).emit('queue:update', data);
	    });
	}
    });
};
