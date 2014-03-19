/* global require, module */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config),
    async = require('async');


var load = function(req, res, next) {
    db.model('Vitamin').findOne({
	id: req.param('vitamin')
    }).exec(function(err, vitamin) {
	if (err) {
	    log.error(err);
	    res.send(500, {
		session: req.user,
		data: err
	    });
	} else if (!vitamin) {
	    res.send(404, {
		session: req.user,
		data: err
	    });
	} else {
	    res.locals.vitamin = vitamin;
	    next();
	}
    });
};

var summary = function(req, res) {
    async.waterfall([
	function(callback) {
	    db.knex('prescriptions')
		.select(db.knex.raw('count(subscriptions.prescriber_id) as score, prescriptions.prescriber_id'))
		.join('prescriptions_vitamins', 'prescriptions_vitamins.prescription_id', '=', 'prescriptions.id', 'inner')
		.join('subscriptions', 'subscriptions.prescriber_id', '=', 'prescriptions.prescriber_id', 'left')
		.where('prescriptions_vitamins.vitamin_id', res.locals.vitamin.id)
		.orderBy('score', 'desc')
		.limit(8)
		.exec(callback);
	},

	function(prescribers, callback) {
	    var ids = [];
	    for (var i=0; i<prescribers.length; i++) {
		ids.push(prescribers[i].prescriber_id);
	    }
	    db.model('User').collection().query('whereIn', 'id', ids).fetch().exec(callback);
	}

    ], function(err, users) {
	if (err) log.error(err);

	var user = res.locals.vitamin.toJSON();
	user.users = users.toJSON();

	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : user
	});
    });
};

var create = function(req, res) {
    db.model('Vitamin').upload({
	url: req.param('url'),
	title: req.param('title')
    }, function(err, vitamin) {
	if (err) log.error(err);
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : vitamin.toJSON()
	});
    });
};

var read = function(req, res) {
    res.locals.vitamin.fetch({
	withRelated: [
	    'hosts',
	    'prescriptions',
	    'prescriptions.prescriber',
	    'prescriptions.vitamins',
	    'prescriptions.vitamins.hosts'
	]
    }).exec(function(err, vitamin) {
	if (err) log.error(err);
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : vitamin.toJSON()
	});
    });
};

var update = function(req, res) {
    db.model('Vitamin').update({
	id: res.locals.vitamin.id,
	title: req.param('title')
    }).exec(function(err, vitamin) {
	if (err) log.error(err);
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : vitamin.toJSON()
	});
    });
};

var prescriptions = function(req, res) {
    var offset = req.param('offset') || 0;
    res.locals.vitamin.fetch({
	withRelated: [
	    {
		'prescriptions': function(qb) {
		    qb.whereNull('prescriptions.recipient_id')
			.orderBy('prescriptions.created_at', 'desc')
			.limit(20)
			.offset(offset);
		}
	    },
	    'prescriptions.prescriber',
	    'prescriptions.vitamins',
	    'prescriptions.vitamins.hosts'
	]
    }).exec(function(err, vitamin) {
	if (err) log.error(err);
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : vitamin.toJSON()
	});
    });
};

var pages = function(req, res) {
    var offset = req.param('offset') || 0;
    res.locals.vitamin.fetch({
	withRelated: [
	    'pages'
	]
    }).exec(function(err, vitamin) {
	if (err) log.error(err);
	res.end(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : vitamin.toJSON()
	});
    });
};

module.exports = {
    load: load,
    create: create,
    read: read,
    update: update,
    prescriptions: prescriptions,
    pages: pages,
    summary: summary
};
