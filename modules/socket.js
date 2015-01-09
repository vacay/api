/* global require, module, __dirname */

var config = require('config-api'),
    async = require('async'),
    path = require('path'),
    fs = require('fs'),
    log = require('log')(config.log);

module.exports = function(io, queue, redis) {

    var listenersDir = __dirname + '/../sockets';
    var files = fs.readdirSync(listenersDir).sort();
    var listeners = [];

    async.each(files, function(file, done) {

	if (/\.js$/.test(file)) {
	    var listener = require(path.join(listenersDir, file));
	    listeners.push(listener);
	}

	done();

    }, function() {

	if (!listeners.length) return;

	var users = [];

	io.on('connection', function(socket) {

	    log.debug('successful socket connection to', socket.decoded_token.username);

	    listeners.forEach(function(listener) {
		listener(io, socket, redis, queue, users);
	    });
	});
    });
};
