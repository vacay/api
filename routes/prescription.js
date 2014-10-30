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
	    if (err) log.error(err, res.locals.logRequest(req));
	    res.status(err ? 500 : 404).send({
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
		'vitamins.tags': function(qb) {
		    qb.where('tags.user_id', req.user ? req.user.id : 0);
		}
	    },
	    {
		'vitamins.craters': function(qb) {
		    qb.where('crates.user_id', req.user ? req.user.id : 0);
		}
	    },
	    'users',
	    'groups',
	    'children',
	    'children.prescriber',
	    'parent',
	    'parent.prescriber'
	]
    }).exec(function(err, prescription) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user || null,
	    data: err ? err : prescription.toJSON()
	});
    });
};

var create = function(req, res) {

    var params = {};

    if (typeof req.param('image') !== 'undefined') params.image_url = req.param('image');
    if (typeof req.param('description') !== 'undefined') params.description = req.param('description');
    if (typeof req.param('published_at') !== 'undefined') params.published_at = new Date();
    if (typeof req.param('parent_id') !== 'undefined') params.parent_id = req.param('parent_id');

    params.prescriber_id = req.user.id;

    async.waterfall([

	function(callback) {
	    if (params.description && params.description.length > 500) {
		callback('prescription description length of ' + params.description.length + ' is greater than limit of 500');
	    } else if (req.param('vitamins') && req.param('vitamins').length > 100) {
		callback('prescription vitamin length of ' + req.param('vitamins').length + ' is greater than limit of 100');
	    } else {
		callback();
	    }
	},

	function(callback) {
	    db.model('Prescription').create(params).exec(callback);
	},

	function(prescription, callback) {

	    if (!req.param('vitamins')) {
		callback(null, prescription);
		return;
	    }

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
	},

	function(prescription, callback) {

	    if (!req.param('users')) {
		callback(null, prescription);
		return;
	    }

	    var users = req.param('users');
	    for (var i=0; i<users.length; i++) {
		users[i].prescription_id = prescription.id;
	    }

	    if (users.length) {
		db.knex('prescriptions_users').insert(users).exec(function(err) {
		    callback(err, prescription);
		});
	    } else {
		callback(null, prescription);
	    }
	},

	function(prescription, callback) {

	    if (!req.param('groups')) {
		callback(null, prescription);
		return;
	    }

	    var groups = req.param('groups');
	    for (var i=0; i<groups.length; i++) {
		groups[i].prescription_id = prescription.id;
	    }

	    if (groups.length) {
		db.knex('prescriptions_groups').insert(groups).exec(function(err) {
		    callback(err, prescription);
		});
	    } else {
		callback(null, prescription);
	    }
	}

    ], function(err, prescription) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : prescription.toJSON()
	});
    });
};

var update = function(req, res) {

    var params = {};
    if (typeof req.param('image') !== 'undefined') params.image_url = req.param('image');
    if (typeof req.param('description') !== 'undefined') params.description = req.param('description');
    if (typeof req.param('published_at') !== 'undefined') params.published_at = new Date();

    params.id = req.param('prescription');

    async.waterfall([

	function(callback) {
	    if (params.description && params.description.length > 500) {
		callback('prescription description length: ' + params.description.length + ' greater than limit of 500');
	    } else if (req.param('vitamins') && req.param('vitamins').length > 100) {
		callback('prescription vitamin length: ' + req.param('vitamins').length + ' greater than limit of 100');
	    } else {
		callback();
	    }
	},

	function(callback) {
	    db.model('Prescription').edit(params).exec(callback);
	},
	
	function(prescription, callback) {

	    if (!req.param('vitamins')) {
		callback(null, prescription);
		return;
	    }

	    db.knex('prescriptions_vitamins')
		.where('prescription_id', prescription.id)
		.del()
		.exec(function(err) {
		    callback(err, prescription);
		});
	},

	function(prescription, callback) {

	    if (!req.param('vitamins')) {
		callback(null, prescription);
		return;
	    }

	    var vitamins = req.param('vitamins');

	    if (vitamins.length) {

		for (var i=0; i<vitamins.length; i++) {
		    vitamins[i].prescription_id = prescription.id;
		}

		db.knex('prescriptions_vitamins').insert(vitamins).exec(function(err) {
		    callback(err, prescription);
		});

	    } else {
		callback(null, prescription);
	    }

	},

	function(prescription, callback) {

	    if (!req.param('users')) {
		callback(null, prescription);
		return;
	    }

	    db.knex('prescriptions_users')
		.where('prescription_id', prescription.id)
		.del()
		.exec(function(err) {
		    callback(err, prescription);
		});
	},

	function(prescription, callback) {

	    if (!req.param('users')) {
		callback(null, prescription);
		return;
	    }

	    var users = req.param('users');

	    if (users.length) {

		for (var i=0; i<users.length; i++) {
		    users[i].prescription_id = prescription.id;
		}

		db.knex('prescriptions_users').insert(users).exec(function(err) {
		    callback(err, prescription);
		});

	    } else {
		callback(null, prescription);
	    }
	},

	function(prescription, callback) {

	    if (!req.param('groups')) {
		callback(null, prescription);
		return;
	    }

	    db.knex('prescriptions_groups')
		.where('prescription_id', prescription.id)
		.del()
		.exec(function(err) {
		    callback(err, prescription);
		});
	},

	function(prescription, callback) {

	    if (!req.param('groups')) {
		callback(null, prescription);
		return;
	    }

	    var groups = req.param('groups');

	    if (groups.length) {

		for (var i=0; i<groups.length; i++) {
		    groups[i].prescription_id = prescription.id;
		}

		db.knex('prescriptions_groups').insert(groups).exec(function(err) {
		    callback(err, prescription);
		});

	    } else {
		callback(null, prescription);
	    }

	}

    ], function(err, prescription) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : prescription.toJSON()
	});
    });
};

var destroy = function(req, res) {
    db.model('Prescription')
	.destroy(req.param('prescription'))
	.exec(function(err, prescription) {
	    if (err) log.error(err, res.locals.logRequest(req));
	    else {
		res.locals.es.delete({
		    index: 'vcy',
		    type: 'prescriptions',
		    id: req.param('prescription')
		}, function(err2) {
		    if (err2 && err2.message !== 'Not Found') log.error(err2, res.locals.logRequest(req));
		});
	    }

	    res.status(err ? 500 : 200).send({
		session: req.user,
		data: err ? err : prescription.toJSON()
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
			qb.leftOuterJoin('prescriptions_users', 'prescriptions.id', 'prescriptions_users.prescription_id')
			    .whereNull('prescriptions_users.user_id')
			    .whereNotNull('prescriptions.published_at')
			    .whereNull('prescriptions.parent_id')
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
			    'vitamins.tags': function(qb) {
				qb.where('tags.user_id', req.user.id);
			    }
			},
			{
			    'vitamins.craters': function(qb) {
				qb.where('crates.user_id', req.user.id);
			    }
			},
			'users',
			'groups',
			'children',
			'children.prescriber',
			'parent',
			'parent.prescriber'
		    ]
		}).exec(callback);
	}

    ], function(err, prescriptions) {

	var data = [];

	if (err) log.error(err, res.locals.logRequest(req));
	else {
	    data = !prescriptions ? [] : prescriptions.toJSON();

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

module.exports = {
    load: load,
    read: read,
    create: create,
    update: update,
    destroy: destroy,
    browse: browse
};
