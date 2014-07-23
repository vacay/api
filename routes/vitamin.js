/* global require, module */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config),
    utils = require('../lib/utils'),
    async = require('async');

var load = function(req, res, next) {
    db.model('Vitamin').findOne({
	id: req.param('vitamin')
    }, {
	withRelated: [
	    {
		'crates': function(qb) {
		    qb.where('user_id', req.user.id);
		}
	    }
	]
    }).exec(function(err, vitamin) {
	if (err) {
	    log.error(err, res.locals.logRequest(req));
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
		.innerJoin('prescriptions_vitamins', 'prescriptions.id', 'prescriptions_vitamins.prescription_id')
		.leftJoin('subscriptions', 'prescriptions.precriber_id', 'subscriptions.prescriber_id')
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
		if (err) log.error(err, res.locals.logRequest(req));

		var vitamin = res.locals.vitamin.toJSON();
		vitamin.users = users.toJSON();

		res.send(err ? 500 : 200, {
		    session: req.user,
		    data: err ? err : vitamin
		});
	    });
};

var create = function(req, res) {
    db.model('Vitamin').findOrCreate({
	url: req.param('url'),
	duration: req.param('duration'),
	title: req.param('title'),
	host: req.param('host'),
	id: req.param('id'),
	stream_url: req.param('stream_url')
    }, function(err, vitamin) {
	if (err) log.error(err, res.locals.logRequest(req));
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
	    {
		'crates': function(qb) {
		    qb.where('user_id', req.user.id);
		}
	    },
	    'prescriptions',
	    'prescriptions.prescriber',
	    'prescriptions.vitamins',
	    'prescriptions.vitamins.hosts',
	    {
		'prescriptions.vitamins.crates': function(qb) {
		    qb.where('user_id', req.user.id);
		}
	    }
	]
    }).exec(function(err, vitamin) {
	if (err) log.error(err, res.locals.logRequest(req));
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
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : vitamin.toJSON()
	});
    });
};

var prescriptions = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;
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
	    'prescriptions.vitamins.hosts',
	    {
		'prescriptions.vitamins.crates': function(qb) {
		    qb.where('user_id', req.user.id);
		}
	    }
	]
    }).exec(function(err, vitamin) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : vitamin.toJSON()
	});
    });
};

var pages = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;
    res.locals.vitamin.fetch({
	withRelated: [
	    'pages'
	]
    }).exec(function(err, vitamin) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.end(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : vitamin.toJSON()
	});
    });
};

var browse = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;
    var query = req.param('q') || null;
    var ids = req.param('ids') || [];

    async.waterfall([

	function(callback) {
	    if (query) {
		res.locals.es.search({
		    index: 'vcy',
		    type: 'vitamins',
		    q: query,
		    size: 10
		}, callback);
	    } else {
		callback(null, null, null);
	    }
	},

	function(search, status, callback) {

	    if (search) {
		ids = [];
		var hits = search.hits.hits;
		for(var i=0; i<hits.length; i++) {
		    ids.push(hits[i]._source.id);
		}
		if (!ids.length) {
		    callback(null, null);
		    return;
		}
	    }

	    if (ids && !Array.isArray(ids)) ids = [ids];

	    db.model('Vitamin')
		.collection()
		.query(function(qb) {
		    if (ids.length) {
			qb.whereIn('id', ids);
		    } else {
			qb.limit(20)
			    .offset(offset)
			    .orderBy('created_at', 'desc');
		    }
		})
		.fetch({ withRelated: [
		    'hosts',
		    {
			'crates': function(qb) {
			    qb.where('user_id', req.user.id);
			}
		    }
		] }).exec(callback);
	}

    ], function(err, vitamins) {
	if (err) log.error(err, res.locals.logRequest(req));
	var data = err || !vitamins ? [] : vitamins.toJSON();

	if (ids.length) {
	    utils.orderArray(ids, data);
	}

	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: data
	});
    });
};

var sync = function(req, res) {
    var ids = req.param('ids');
    var last_synced_at = req.param('last_synced_at') || null;

    db.model('Vitamin').collection().query(function(qb) {
	qb.whereIn('id', ids);
	if (last_synced_at) qb.andWhere('updated_at', '>', last_synced_at);
    }).fetch({ withRelated: ['hosts'] }).exec(function(err, vitamins) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err || !vitamins ? err || [] : vitamins.toJSON()
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
    summary: summary,
    browse: browse,
    sync: sync
};
