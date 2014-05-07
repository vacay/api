/* global require, module */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config),
    utils = require('../lib/utils'),
    async = require('async');

var load = function(req, res, next) {
    db.model('Prescription').findOne({
	id: req.param('prescription')
    }).exec(function(err, prescription) {
	if (err || !prescription) {
	    if (err) log.error(err);
	    res.send(err ? 500 : 404, {
		session: req.user,
		data: err ? err : 'invalid page id: ' + req.param('prescription')
	    });
	} else {
	    res.locals.prescription = prescription;
	    next();
	}
    });
};

var read = function(req, res) {
    res.locals.prescription.fetch({
	withRelated: [
	    'prescriber',
	    'vitamins',
	    'vitamins.hosts',
	    {
		'vitamins.crates': function(qb) {
		    qb.where('user_id', req.user.id);
		}
	    }
	]
    }).exec(function(err, prescription) {
	if (err) log.error(err);
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : prescription.toJSON()
	});
    });
};

var create = function(req, res) {
    async.waterfall([

	function(callback) {	    
	    db.model('Prescription').create({
		image_url: req.param('image') || null,
		description: req.param('description') || null,
		prescriber_id: req.user.id,
		recipient_id: req.param('recipient') || null
	    }).exec(callback);
	},

	function(prescription, callback) {

	    var vitamins = req.param('vitamins');
	    for (var i=0; i<vitamins.length; i++) {
		vitamins[i].prescription_id = prescription.id;
	    }

	    if (vitamins.length) {
		db.knex('prescriptions_vitamins').insert(vitamins).exec(function(err) {
		    callback(err, prescription);
		});
	    } else {
		callback(null, prescription);
	    }
	}

    ], function(err, prescription) {
	if (err) log.error(err);
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : prescription.toJSON()
	});
    });
};

var publish = function(req, res) {
    db.model('Prescription').edit({
	id: req.param('prescription'),
	published_at: new Date()
    }).exec(function(err, prescription) {
	if (err) log.error(err);
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : prescription.toJSON()
	});
    });
};

var update = function(req, res) {
    async.waterfall([

	function(callback) {
	    db.model('Prescription').edit({
		id: req.param('prescription'),
		image_url: req.param('image') || null,
		description: req.param('description') || null
	    }).exec(callback);
	},
	
	function(prescription, callback) {
	    db.knex('prescriptions_vitamins')
		.where('prescription_id', prescription.id)
		.del()
		.exec(function(err) {
		    callback(err, prescription);
		});
	},

	function(prescription, callback) {

	    var vitamins = req.param('vitamins') || [];
	    for (var i=0; i<vitamins.length; i++) {
		vitamins[i].prescription_id = prescription.id;
	    }

	    if (vitamins.length) {
		db.knex('prescriptions_vitamins').insert(vitamins).exec(function(err) {
		    callback(err, prescription);
		});
	    } else {
		callback(null, prescription);
	    }
	}

    ], function(err, prescription) {
	if (err) log.error(err);
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : prescription.toJSON()
	});
    });
};

var destroy = function(req, res) {
    //TODO: delete vitamin relations too
    db.model('Prescription')
	.destroy(req.param('prescription'))
	.exec(function(err, prescription) {
	    if (err) log.error(err);
	    res.send(err ? 500 : 200, {
		session: req.user,
		data: err ? err : prescription.toJSON()
	    });
	});
};

var browse = function(req, res) {
    var offset = req.param('offset') || 0;
    var query = req.param('q') || null;
    var ids = req.param('ids') || [];

    async.waterfall([

	function(callback) {
	    if (query) {
		res.locals.es.search({
		    index: 'vcy',
		    type: 'prescriptions',
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
	    db.model('Prescription')
		.collection()
		.query(function(qb) {
		    if (ids.length) {
			qb.whereIn('id', ids);
		    } else {
			qb.whereNotNull('published_at')
			    .limit(20)
			    .offset(offset)
			    .orderBy('published_at', 'desc');
		    }
		})
		.fetch({
		    withRelated: [
			'prescriber',
			'vitamins',
			'vitamins.hosts',
			{
			    'vitamins.crates': function(qb) {
				qb.where('user_id', req.user.id);
			    }
			}
		    ]
		}).exec(callback);
	}

    ], function(err, prescriptions) {
	if (err) log.error(err);
	var data = err || !prescriptions ? err || [] : prescriptions.toJSON();

	if (ids.length) {
	    utils.orderArray(ids, data);
	}

	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: data
	});
    });
};

module.exports = {
    load: load,
    read: read,
    create: create,
    update: update,
    publish: publish,
    destroy: destroy,
    browse: browse
};
