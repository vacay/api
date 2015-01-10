/* global module */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config),
    roomdata = require('roomdata');

var EXPIRES = 604800;

var findWithAttr = function(array, attr, value) {
    for(var i = 0; i < array.length; i += 1) {
        if(array[i][attr] === value) {
            return i;
        }
    }

    return -1;
};

module.exports = function(io, socket, redis, queue, users) {

    var user = socket.decoded_token.username;

    var updateMaster = function() {
	var data = {
	    css: 'paused',
	    playing: false
	};

	var master = roomdata.get(socket, 'master');

	redis.set(user + ':css', JSON.stringify(data));
	redis.expire(user + ':css', EXPIRES);
	io.to(user).emit('sync', {
	    master: master
	});
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

    var leaveRoom = function(name) {

	roomdata.set(socket, 'user', null);

	// remove all clients of user
	Object.keys(io.nsps['/'].adapter.rooms[user]).forEach(function(s) {
	    io.sockets.connected[s].leave('user:' + name);
	});

	// infrom all clients of user about leaving
	io.to(user).emit('left');
    };

    socket.on('join', function(data) {
	var room = data.room;

	// can't listen in on yourself
	if (room === user) return;

	// can't listen in on an a non live user
	if (!Object.keys(io.nsps['/'].adapter.rooms[room]).length) return;

	// if in another room - remove first
	if (socket.rooms.length > 2 ) leaveRoom(socket.rooms[2]);

	// remove from live users
	var idx = findWithAttr(users, 'username', user);
	if (idx !== -1) {
	    users.splice(idx, 1);
	    io.emit('users', users);
	}

	roomdata.set(socket, 'user', room);

	// add all clients of user to room
	Object.keys(io.nsps['/'].adapter.rooms[user]).forEach(function(s){
	    io.sockets.connected[s].join('user:' + room);
	});

	// inform all clients of user about joining
	io.to(user).emit('joined', {
	    socket: socket.id,
	    clients: Object.keys(io.nsps['/'].adapter.rooms['user:' + room]),
	    room: room
	});

	//TODO: send current position
	// send current song to all clients of user
	redis.get(room + ':nowplaying', function(err, reply) {
	    if (err) log.error(err);
	    else {
		var data = JSON.parse(reply);
		if (data) {
		    io.to(user).emit('room:nowplaying', {
			vitamin: data,
			room: room
		    });
		}
	    }
	});

	socket.on('leave', function(data) {
	    if (room === data.room) leaveRoom(room);
	});
    });

    socket.join(user, function(err) {
	if (err) log.error(err);

	roomdata.joinRoom(socket, user);

	var master = roomdata.get(socket, 'master');
	if (!master) master = Object.keys(io.nsps['/'].adapter.rooms[user])[0];

	roomdata.set(socket, 'master', master);

	socket.on('set:master', function() {
	    master = socket.id;
	    roomdata.set(socket, 'master', master);
	    updateMaster();
	});

	socket.on('init:player', function(data) {
	    if (data.master && master !== socket.id) {
		master = socket.id;
		roomdata.set(socket, 'master', master);
		updateMaster();
	    }

	    var clients = Object.keys(io.nsps['/'].adapter.rooms[user]);

	    socket.emit('init', {
		socket: socket.id,
		clients: clients,
		master: master,
		rooms: socket.rooms,
		users: users,
		room: roomdata.get(socket, 'user')
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
	    if (Object.keys(io.nsps['/'].adapter.rooms[user]).length > 1) socket.to(user).emit('player:next');
	});

	socket.on('player:play', function(data) {
	    if (Object.keys(io.nsps['/'].adapter.rooms[user]).length > 1) socket.to(user).emit('player:play', data);
	});

	socket.on('player:previous', function() {
	    if (Object.keys(io.nsps['/'].adapter.rooms[user]).length > 1) socket.to(user).emit('player:previous');
	});

	socket.on('player:position:update', function(data) {
	    if (Object.keys(io.nsps['/'].adapter.rooms[user]).length > 1) socket.to(user).emit('player:position:update', data);
	});

	socket.on('player:loading:update', function(data) {
	    if (Object.keys(io.nsps['/'].adapter.rooms[user]).length > 1) socket.to(user).emit('player:loading:update', data);
	});

	socket.on('player:time:update', function(data) {
	    if (Object.keys(io.nsps['/'].adapter.rooms[user]).length > 1) socket.to(user).emit('player:time:update', data);
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
	    socket.to(user).emit('player:nowplaying:update', {
		nowplaying: data.nowplaying
	    });

	    //listen in mode
	    socket.to('user:' + user).emit('room:nowplaying', {
		vitamin: data.nowplaying,
		room: user
	    });

	    var obj = users.filter(function(obj) {
		return obj.username === user;
	    })[0];

	    if (!obj && !data.room && data.user) {
		users.push(data.user);
		io.emit('users', users);
	    }
	});

	socket.on('player:volume', function(data) {
	    redis.set(user + ':volume', JSON.stringify(data.volume));
	    redis.expire(user + ':volume', EXPIRES);

	    socket.to(user).emit('player:volume', data);
	});

    });

    socket.on('disconnect', function() {
	var master = roomdata.get(socket, 'master');

	var userRoom = io.nsps['/'].adapter.rooms[user];

	if (master === socket.id && userRoom) {
	    var clients = Object.keys(userRoom);
	    master = clients[0];
	    roomdata.set(socket, 'master', master);
	    updateMaster();
	}

	roomdata.leaveRoom(socket);

	// if there are no other clients of user connected - stop others from listening in
	var idx = findWithAttr(users, 'username', user);
	if (idx !== -1 && !userRoom) {

	    // remove from live users list
	    users.splice(idx, 1);
	    io.emit('users', users);

	    // kick everyone out of the room
	    io.to('user:' + user).emit('left');
	    var room = io.nsps['/'].adapter.rooms['user:' + user];
	    if (room) {
		Object.keys(room).forEach(function(s){
		    io.sockets.connected[s].leave('user:' + user);
		});
	    }
	}
    });
};
