/* global require, module */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config);

var create = function(req, res) {
    var prescriber_id = res.locals.user ? res.locals.user.id : res.locals.group.id;
    var prescriber_type = res.locals.user ? 'users' : 'groups';

    db.knex('subscriptions').insert({
	prescriber_id: prescriber_id,
	prescriber_type: prescriber_type,
	subscriber_id: req.user.id,
	created_at: new Date(),
	updated_at: new Date()
    }).exec(function(err, subscription) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : subscription
	});
    });
};

var destroy = function(req, res) {
    var prescriber_id = res.locals.user ? res.locals.user.id : res.locals.group.id;
    var prescriber_type = res.locals.user ? 'users' : 'groups';

    db.knex('subscriptions').where({
	prescriber_id: prescriber_id,
	prescriber_type: prescriber_type,
	subscriber_id: req.user.id
    }).del().exec(function(err, numRows) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : numRows
	});
    });
};

module.exports = {
    create: create,
    destroy: destroy
};
