/* global require, module */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config);

var create = function(req, res) {
    var prescriber_id, prescriber_type;

    if (res.locals.user) {
	prescriber_id = res.locals.user.id;
	prescriber_type = 'users';
    } else if (res.locals.group) {
	prescriber_id = res.locals.group.id;
	prescriber_type = 'groups';
    } else if (res.locals.page) {
	prescriber_id = res.locals.page.id;
	prescriber_type = 'pages';
    } else if (res.locals.artist) {
	prescriber_id = res.locals.artist.id;
	prescriber_type = 'artists';
    } else {
	res.status(500).send({
	    session: req.user,
	    data: 'missing prescriber information'
	});
	return;
    }

    db.knex('subscriptions').insert({
	prescriber_id: prescriber_id,
	prescriber_type: prescriber_type,
	subscriber_id: req.user.id,
	created_at: new Date(),
	updated_at: new Date()
    }).asCallback(function(err, subscription) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : subscription
	});
    });
};

var destroy = function(req, res) {
    var prescriber_id, prescriber_type;

    if (res.locals.user) {
	prescriber_id = res.locals.user.id;
	prescriber_type = 'users';
    } else if (res.locals.group) {
	prescriber_id = res.locals.group.id;
	prescriber_type = 'groups';
    } else if (res.locals.page) {
	prescriber_id = res.locals.page.id;
	prescriber_type = 'pages';
    } else if (res.locals.artist) {
	prescriber_id = res.locals.artist.id;
	prescriber_type = 'artists';
    } else {
	res.status(500).send({
	    session: req.user,
	    data: 'missing prescriber information'
	});
	return;
    }

    db.knex('subscriptions').where({
	prescriber_id: prescriber_id,
	prescriber_type: prescriber_type,
	subscriber_id: req.user.id
    }).del().asCallback(function(err, numRows) {
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
