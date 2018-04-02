var async = require('async'),
    config = require('config-api'),
    redis = require('redis');

var client = redis.createClient(config.redis.port, config.redis.host, config.redis.options);

exports.rooms = {};

exports.exists = function(room) {
    return !!this.rooms[room];
};

exports.create = function(socket, room) {
    this.rooms[room] = {
	master:socket.id,
	users:[],
	variables: {}
    };
};

exports.room = function(username, cb) {
    //TODO - validate
    client.get('u:' + username + ':room', cb);
};

exports.set = function(socket, variable, content) {
    if (!this.exists(socket.roomdata_room)) return false;

    if (variable === 'master') return this.rooms[socket.roomdata_room].master = content;
    this.rooms[socket.roomdata_room].variables[variable] = content;
};

exports.get = function(room, variable) {
    if (!this.exists(room)) return undefined;

    if (variable === 'master') return this.rooms[room].master;
    if (variable === 'masterUA') {
	var masterID = this.rooms[room].master;
	var masterUser = this.rooms[room].users.filter(function(s) {
	    return s.socket === masterID;
	});
	return masterUser.length && masterUser[0].ua;
    }
    if (variable === 'users') return this.rooms[room].users;
    return this.rooms[room].variables[variable];
};

exports.join = function(socket, room, opts) {
    opts = opts || {};

    if (socket.roomdata_room) this.leave(socket, room);
    if (!this.exists(room)) this.create(socket, room);
    if (opts.master) this.rooms[room].master = socket.id;
    this.rooms[room].users.push({
	socket: socket.id,
	ua: socket.handshake.headers['user-agent']
    });
    socket.join(room);
    socket.roomdata_room = room;
};

exports.clear = function(room) {
    delete this.rooms[room];
};

exports.leave = function(socket) {
    var room = socket.roomdata_room;

    for (var i=0; i < this.rooms[room].users.length; i++) {
	if (this.rooms[room].users[i].socket === socket.id) {
	    this.rooms[room].users.splice(i, 1);
	    break;
	}
    }
    socket.leave(socket.roomdata_room);

    if (this.rooms[room].users.length == 0) {
	this.clear(room);
	return;
    }

    if (this.rooms[room].master === socket.id)
	this.rooms[room].master = this.rooms[room].users[0].socket;
};

exports.sync = function(socket, username, room) {
    socket.broadcast.to(username).emit('sync', {
	sessions: this.get(username, 'users'),
	room: room,
	username: username
    });
};

exports.setMaster = function(io, username) {
    io.to(username).emit('master', {
	master: this.get(username, 'master'),
	ua: this.get(username, 'masterUA')
    });
};
