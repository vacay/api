/* global require, module */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config),
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
	    'vitamins.hosts'
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
		image_url: req.param('image'),
		description: req.param('description'),
		prescriber_id: req.user.id,
		recipient_id: req.param('recipient')
	    }).exec(callback);
	},

	function(prescription, callback) {

	    var vitamins = req.param('vitamins');
	    for (var i=0; i<vitamins.length; i++) {
		vitamins[i].prescription_id = prescription.id;
	    }

	    db.knex('prescriptions_vitamins').insert(vitamins).exec(function(err) {
		callback(err, prescription);
	    });
	}

    ], function(err, prescription) {
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
		description: req.param('description')
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

	    var vitamins = req.param('vitamins');
	    for (var i=0; i<vitamins.length; i++) {
		vitamins[i].prescription_id = prescription.id;
	    }

	    db.knex('prescriptions_vitamins').insert(vitamins).exec(function(err) {
		callback(err, prescription);
	    });
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
    var ids = req.param('ids'); //TODO: validate format
    if (ids && !Array.isArray(ids)) ids = [ids];
    db.model('Prescription')
	.collection()
	.query(function(qb) {
	    if (ids) {
		qb.whereIn('id', ids);
	    } else {
		qb.limit(20).offset(offset).orderBy('created_at', 'desc');
	    }
	})
	.fetch({
	    withRelated: [
		'prescriber',
		'vitamins',
		'vitamins.hosts'
	    ]
	}).exec(function(err, prescriptions) {
	    if (err) log.error(err);
	    res.send(err ? 500 : 200, {
		session: req.user,
		data: err ? err : prescriptions.toJSON()
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
