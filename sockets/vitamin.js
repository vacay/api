/* global module, require */

module.exports = function(socket) {
    socket.on('vitamin:play', function(data) {
	socket.broadcast.emit('vitamin:play', data);
    });
};
