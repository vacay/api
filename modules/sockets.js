/* global require, module, __dirname */

var config = require('config'),
    async = require('async'),
    path = require('path'),
    fs = require('fs'),
    log = require('log')(config.log),
    socketioJwt = require('socketio-jwt');

module.exports = function(io) {
    
    'use strict';

    var listenersDir = __dirname + '/../sockets';
    var listeners = [];

    async.forEachSeries(fs.readdirSync(listenersDir).sort(), function(file, next) { /* match .js files only (for now) */
	if (/\.js$/.test(file)) {
	    listeners.push(require(path.join(listenersDir, file)));
	}

	next();

    }, function() {
	if (!listeners.length) return log.warn('No socket.io listeners; socket.io not listening for connections');
	io.enable('browser client minification');
	io.enable('browser client etag');
	io.enable('browser client gzip');
	io.set('log level', config.sockets.log_level);
	io.sockets.on('connection', function(socket) {
	    listeners.forEach(function(listener) {
		listener(socket);
	    });
	});
    });
};
