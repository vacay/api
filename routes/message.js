/* global module */

var create = function(req, res) {
    var emails = ['kr@vacay.io'];
    var subject = '[contact] ' + req.param('subject');
    var body = req.param('name') + ' - ' + req.param('body');

    res.locals.queue.create('email', {
	title: 'contact:' + req.param('email'),
	emails: emails,
	replyTo: req.param('email'),
	subject: subject,
	body: body
    }).removeOnComplete(true).save();

    res.status(200).send({
	session: req.user,
	data: 'sent'
    });
};

module.exports = {
    create: create
};
