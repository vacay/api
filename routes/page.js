/* global module, require */

var URI = require('URIjs'),
    config = require('config-api'),
    log = require('log')(config.log),
    async = require('async'),
    utils = require('../lib/utils'),
    db = require('db')(config);


var load = function(req, res, next) {
    db.model('Page').findOne({
	id: req.param('page')
    }).exec(function(err, page) {
	if (err) {
	    log.error(err, res.locals.logRequest(req));
	    res.status(500).send({
		session: req.user,
		data: err
	    });
	} else if (!page) {
	    res.status(404).send({
		session: req.user,
		data: 'invalid page id: ' + req.param('page')
	    });
	} else {
	    res.locals.page = page;
	    next();
	}
    });
};

var browse = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;
    var query = req.param('q') ? unescape(req.param('q')) : null;
    var ids = req.param('ids') || [];

    var is_static = req.param('is_static') || undefined;
    var orderBy = req.param('orderby') || 'created_at';
    var direction = req.param('dir') || 'desc';

    var vitamins = req.param('vitamins') || undefined;

    async.waterfall([

	function(callback) {
	    if (query) {
		res.locals.es.search({
		    index: 'vcy',
		    type: 'pages',
		    q: utils.escape(query),
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
	    db.model('Page')
		.collection()
		.query(function(qb) {
		    if (ids.length) {
			qb.whereIn('id', ids);
		    } else {
			qb.limit(10).offset(offset);

			if (typeof is_static !== 'undefined') qb.where('is_static', is_static);

			if (vitamins === 'true') {
			    qb.innerJoin('pages_vitamins', 'pages.id', 'pages_vitamins.page_id').groupBy('pages.id');
			}
			
			if (orderBy === 'popular') {
			    qb.select(db.knex.raw('count(subscriptions.prescriber_id) as subscribers'));
			    qb.leftJoin('subscriptions', 'pages.id', 'subscriptions.prescriber_id');
			    qb.where('subscriptions.prescriber_type', 'pages');
			    qb.groupBy('subscriptions.prescriber_id');
			    qb.orderBy('subscribers', direction);
			} else {
			    qb.orderBy(orderBy, direction);
			}
		    }
		}).fetch({
		    withRelated: [
			'vitaminCount'
		    ]
		}).exec(callback);
	}

    ], function(err, pages) {

	var data = [];

	if (err) log.error(err, res.locals.logRequest(req));
	else {
	    data = !pages ? [] : pages.toJSON();

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

var create = function(req, res, next) {
    var text = req.param('url').substring(0, 4) === 'http' ? req.param('url') : ('http://' + req.param('url'));
    var uri = new URI(text).protocol('http').normalize();
    var url = uri.subdomain() === '' ? uri.subdomain('www').toString() : uri.toString();
    db.model('Page').findOrCreate(url, function(err, page) {
	if (err) {

	    if (err !== 'page has no body') {
		var errData = res.locals.logRequest(req);
		errData.page = page;
		log.error(err, errData);
	    }

	    res.status(500).send({
		session: req.user,
		data: err
	    });

	} else {
	    res.locals.page = page;
	    next();
	}
    });
};

var read = function(req, res) {
    db.model('Page').forge({id: res.locals.page.id }).fetch({
	withRelated: [
	    {
		'vitamins': function(qb) {
		    qb.limit(20).orderBy('pages_vitamins.created_at', 'desc');
		}
	    },
	    'vitamins.hosts',
	    'vitamins.artists',
	    {
		'vitamins.tags': function(qb) {
		    qb.where('tags.user_id', req.user.id);
		}
	    },
	    {
		'vitamins.craters': function(qb) {
		    qb.where('crates.user_id', req.user.id);
		}
	    }
	]
    }).exec(function(err, page) {
	var data;

	if (err) log.error(err, res.locals.logRequest(req));
	else {
	    data = page.toJSON();
	    data.crates = data.craters; //deprecated - update chrome ext
	}

	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : data
	});
    });
};

var vitamins = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;

    res.locals.page.vitamins().query(function(qb) {
	qb.limit(20).offset(offset).orderBy('pages_vitamins.created_at', 'desc');
    }).fetch({
	withRelated: [
	    'hosts',
	    'artists',
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
	]
    }).exec(function(err, vitamins) {
	if (err) log.error(err, res.locals.logRequest(req));

	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : vitamins.toJSON()
	});
    });
};

module.exports = {
    load: load,
    browse: browse,
    create: create,
    read: read,
    vitamins: vitamins
};
