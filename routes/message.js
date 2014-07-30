/* global module, require */

var create = function(req, res) {
    var emails = ['kr@vacay.io'];
    var subject = '[contact] ' + req.param('subject');
    var html = '<p>' + req.param('body') + '</p>';
    html += '- ' + req.param('name');

    res.locals.queue.create('email', {
	title: 'contact:' + req.param('email'),
	emails: emails,
	replyTo: req.param('email'),
	subject: subject,
	html: html
    }).save();

    res.send(200, {
	session: req.user,
	data: 'sent'
    });
};

module.exports = {
    create: create
};
