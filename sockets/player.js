/* global module */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config);

var EXPIRES = 604800;

module.exports = function(io, socket, redis) {

    var user = socket.decoded_token.username;
    var clients, master;

    socket.on('join:user', function(data) {
	var room = data.name;

	// can't listen in on yourself
	if (room === user) return;

	socket.join('user:' + room, function(err) {
	    if (err) log.error(err);

	    socket.on('leave:group', function(data) {
		if (room === data.name) {
		    socket.leave('user:' + room, function(err) {
			if (err) log.error(err);
		    });
		}
	    });
	});
    });

    socket.join(user, function(err) {
	if (err) log.error(err);

	var resetMaster = function() {
	    var data = {
		css: 'paused',
		playing: false
	    };

	    redis.set(user + ':css', JSON.stringify(data));
	    redis.expire(user + ':css', EXPIRES);
	    io.to(user).emit('player:css:update', data);
	    io.to(user).emit('player:loading:update', {
		loading: {
		    width: '0%'
		}
	    });
	    io.to(user).emit('player:position:update', {
		position: {
		    width: '0%'
		}
	    });
	};

	clients = Object.keys(io.nsps['/'].adapter.rooms[user]);
	master = clients[0];

	socket.on('set:master', function() {
	    master = socket.id;
	    socket.broadcast.to(user).emit('remote');	    
	    resetMaster();
	    socket.emit('master');
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
	    if (data.master && master !== socket.id) {
		master = socket.id;
		socket.broadcast.to(user).emit('remote');
	    }
	    
	    socket.emit(master === socket.id ? 'master' : 'remote', {
		clients: clients,
		master: master,
		socket: socket.id
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

	});

 	socket.on('player:next', function() {
	    if (clients.length > 1) socket.to(user).emit('player:next');
	});

	socket.on('player:play', function(data) {
	    if (clients.length > 1) socket.to(user).emit('player:play', data);
	});

	socket.on('player:previous', function() {
	    if (clients.length > 1) socket.to(user).emit('player:previous');
	});

	socket.on('player:position:update', function(data) {
	    if (clients.length > 1) socket.to(user).emit('player:position:update', data);
	});

	socket.on('player:loading:update', function(data) {
	    if (clients.length > 1) socket.to(user).emit('player:loading:update', data);
	});

	socket.on('player:time:update', function(data) {
	    if (clients.length > 1) socket.to(user).emit('player:time:update', data);
	});

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

	    db.knex('listens').insert({
		user_id: socket.decoded_token.id,
		vitamin_id: data.nowplaying.id,
		created_at: new Date()
	    }).exec(function(err, listen) {
		if (err) log.error(err);
	    });

	    socket.broadcast.emit('vitamin:play', data.nowplaying);
	    socket.to(user).emit('player:nowplaying:update', data);

	    //listen in mode
	    socket.to('user:' + user).emit(user + ':nowplaying', data.nowplaying);
	});

	socket.on('player:volume', function(data) {
	    redis.set(user + ':volume', JSON.stringify(data.volume));
	    redis.expire(user + ':volume', EXPIRES);

	    socket.to(user).emit('player:volume', data);
	});

    });
};
