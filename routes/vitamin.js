/* global require, module, unescape */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config),
    utils = require('../lib/utils'),
    async = require('async');

var load = function(req, res, next) {
    db.model('Vitamin').findOne({
	id: req.param('vitamin')
    }).exec(function(err, vitamin) {
	if (err) {
	    log.error(err, res.locals.logRequest(req));
	    res.status(500).send({
		session: req.user,
		data: err
	    });
	} else if (!vitamin) {
	    res.status(404).send({
		session: req.user,
		data: err
	    });
	} else {
	    res.locals.vitamin = vitamin;
	    next();
	}
    });
};

var create = function(req, res, next) {
    db.model('Vitamin').findOrCreate({
	url: req.param('url'),
	duration: req.param('duration'),
	title: req.param('title'),
	host: req.param('host'),
	id: req.param('id'),
	stream_url: req.param('stream_url')
    }, function(err, vitamin) {
	if (err || !vitamin) {
	    log.error(err, res.locals.logRequest(req));
	    res.status(500).send({
		session: req.user,
		data: 'failed to create vitamin'
	    });
	} else {
	    res.locals.vitamin = vitamin;
	    next();
	}
    });
};

var read = function(req, res) {

    async.parallel({
	vitamin: function(cb) {
	    db.model('Vitamin').forge({
		id: res.locals.vitamin.id
	    }).fetch({
		withRelated: [
		    'hosts',
		    'artists',
		    {
			'tags': function(qb) {
			    qb.where('tags.user_id', req.user.id);
			}
		    },
		    'craters',
		    'pages'
		]
	    }).exec(cb);
	},

	prescribers: function(cb) {
	    db.model('Vitamin').forge({
		id: res.locals.vitamin.id
	    }).prescribers().exec(cb);
	}

    }, function(err, results) {
	if (err) log.error(err, res.locals.logRequest(req));
	else results.vitamin.set({prescribers: results.prescribers});

	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : results.vitamin.toJSON()
	});
    });
};

var update = function(req, res) {
    db.model('Vitamin').update({
	id: res.locals.vitamin.id,
	title: req.param('title')
    }).exec(function(err, vitamin) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : vitamin.toJSON()
	});
    });
};

var browse = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;
    var query = req.param('q') ? unescape(req.param('q')) : null;
    var ids = req.param('ids') || [];

    async.waterfall([

	function(callback) {
	    if (query) {
		res.locals.es.search({
		    index: 'vcy',
		    type: 'vitamins',
		    q: query,
		    size: 10,
		    from: offset
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
			qb.limit(10)
			    .offset(offset)
			    .orderBy('created_at', 'desc');
		    }
		})
		.fetch({ withRelated: [
		    'artists',
		    'hosts',
		    {
			'tags': function(qb) {
			    qb.where('tags.user_id', req.user.id);
			}
		    },
		    {
			'craters': function(qb) {
			    qb.where('crates.user_id', req.user.id);
			}
		    }
		] }).exec(callback);
	}

    ], function(err, vitamins) {

	var data = [];

	if (err) log.error(err, res.locals.logRequest(req));
	else {
	    data = !vitamins ? [] : vitamins.toJSON();

	    if (ids.length) {
		utils.orderArray(ids, data);
	    }
	}

	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : data
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
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : vitamins.toJSON()
	});
    });
};

module.exports = {
    load: load,
    create: create,
    read: read,
    update: update,
    browse: browse,
    sync: sync
};
