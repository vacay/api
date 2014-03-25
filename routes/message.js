/* global module, require */

var config = require('config-api'),
    Mailgun = require('mailgun').Mailgun,
    mg = new Mailgun(config.mailgun);

var create = function(req, res) {
    mg.sendText(
	req.param('name') + ' <' + req.param('email') + '>',
	['kia <kr@vacay.io>'],
	'vacay.io: ' + req.param('subject'),
	req.param('body'),
	function(err) {
	    res.send(err ? 500 : 200, {
		session: req.user,
		data: err ? err : 'Sent'
	    });
	});
};

module.exports = {
    create: create
};
