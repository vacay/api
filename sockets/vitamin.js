/* global module */

var kue = require('kue');

module.exports = function(io, socket, queue) {

    queue.on('job complete', function(id, result) {
	if (result) socket.emit('vitamin:processed', result);
    });

};
