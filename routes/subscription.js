/* global require, module */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config);

var create = function(req, res) {
    db.knex('subscriptions').insert({
	prescriber_id: req.param('prescriber_id'),
	subscriber_id: req.user.id,
	created_at: new Date(),
	updated_at: new Date()
    }).exec(function(err, subscription) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : subscription
	});
    });
};

var destroy = function(req, res) {
    db.knex('subscriptions').where({
	prescriber_id: req.param('prescriber_id'),
	subscriber_id: req.user.id
    }).del().exec(function(err, numRows) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : numRows
	});
    });
};

module.exports = {
    create: create,
    destroy: destroy
};
