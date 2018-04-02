/* global module */
var config	= require('config-api')
var log		= require('log')(config.log)

var create = function(req, res) {
  var emails = ['kr@vacay.io'];
  var subject = '[contact] ' + req.param('subject');
  var body = req.param('name') + ' - ' + req.param('body');

  res.locals.sendEmail({
    title: 'contact:' + req.param('email'),
    emails: emails,
    replyTo: req.param('email'),
    subject: subject,
    body: body
  }, function(err) {
    if (err) log.error(err)
  })

  res.status(200).send({
    session: req.user,
    data: 'sent'
  });
};

module.exports = {
  create: create
};
