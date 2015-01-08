/* global module, require */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config),
    async = require('async');

var all = function(req, res) {
    var last_vitamin = req.param('lv');
    var last_prescription = req.param('lp');
    var limit = parseInt(req.param('limit'), 10) || 20;

    if (limit < 0 || limit > 20) limit = 20;

    var response = function(err, result) {
	var data;
	
	if (err) log.error(err, res.locals.logRequest(req));
	else {
	    var prescriptions = result.prescriptions.toJSON();
	    var vitamins = result.vitamins.toJSON();

	    var combined = prescriptions.concat(vitamins);

	    var sorted = combined.sort(function(a, b) {
		var c = new Date(a.published_at);
		var d = new Date(b.published_at);

		return c > d ? -1 : c < d ? 1 : 0;
	    });

	    data = sorted.slice(0, limit);
	}
	    
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : data
	});
    };

    var user = db.model('User').forge({id: req.user.id});

    user.subscriptions().exec(function(err, subscriptions) {
	if (err) {
	    response(err, null);
	    return;
	}

	var users = [0];
	var groups = [0];
	var pages = [0];

	for(var i=0; i<subscriptions.length; i++) {
	    if (subscriptions[i].prescriber_type === 'users') {
		users.push(subscriptions[i].prescriber_id);
	    } else if (subscriptions[i].prescriber_type === 'groups') {
		groups.push(subscriptions[i].prescriber_id);
	    }
	}

	var prescription_query = function(qb) {

	    qb.leftJoin('prescriptions_users', 'prescriptions.id', 'prescriptions_users.prescription_id');
	    qb.leftJoin('prescriptions_groups', 'prescriptions.id', 'prescriptions_groups.prescription_id');

	    qb.where(function() {
		this.where(function() {
		    this.whereIn('prescriber_id', users).whereNull('prescriptions_users.user_id');
		}).orWhere(function() {
		    this.where('prescriptions_users.user_id', req.user.id).whereNull('parent_id');
		}).orWhere(function() {
		    this.whereIn('prescriptions_groups.group_id', groups).whereNull('parent_id');
		});
	    }).whereNotNull('published_at');

	    if (last_prescription) qb.where('prescriptions.id', '<', last_prescription);

	    qb.limit(limit);
	    qb.groupBy('prescriptions.id');
	    qb.orderBy('published_at', 'desc');
	};

	var vitamin_query = function(qb) {
	    qb.select(db.knex.raw('MAX(pages_vitamins.created_at) as published_at, pages_vitamins.id as join_id, pages_vitamins.page_id as page_id'));
	    qb.innerJoin('pages_vitamins', 'vitamins.id', 'pages_vitamins.vitamin_id');
	    qb.innerJoin('subscriptions', 'pages_vitamins.page_id', 'subscriptions.prescriber_id');
	    qb.where({
		'subscriptions.subscriber_id': req.user.id,
		'subscriptions.prescriber_type': 'pages'
	    });

	    if (last_vitamin) qb.where('pages_vitamins.id', '<', last_vitamin);

	    qb.limit(limit);
	    qb.groupBy('id').orderBy('pages_vitamins.created_at', 'desc');
	};

	async.parallel({

	    vitamins: function(next) {
		db.model('Vitamin').collection().query(vitamin_query).fetch({
		    withRelated: [
			'artists',
			'hosts',
			'pages',
			{
			    tags: function(qb) {
				qb.where('tags.user_id', req.user.id);
			    }
			},
			{
			    craters: function(qb) {
				qb.where('crates.user_id', req.user.id);
			    }
			}
		    ]
		}).exec(next);
	    },

	    prescriptions: function(next) {
		db.model('Prescription').collection().query(prescription_query).fetch({
		    withRelated: [
			'prescriber',
			'vitamins',
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
			},
			'users',
			'groups',
			'children',
			'children.prescriber',
			'parent',
			'parent.prescriber'
		    ]
		}).exec(next);
	    }

	}, response);

    });
};

var prescriptions = function(req, res) {

    var response = function(err, prescriptions) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : prescriptions.toJSON()
	});
    };

    var sort = req.param('sort') || 'desc';
    var offset = parseInt(req.param('offset'), 10) || 0;

    var user = db.model('User').forge({id: req.user.id});

    user.subscriptions().exec(function(err, subscriptions) {
	if (err) {
	    response(err, null);
	    return;
	}

	var users = [0];
	var groups = [0];

	for(var i=0; i<subscriptions.length; i++) {
	    if (subscriptions[i].prescriber_type === 'users') {
		users.push(subscriptions[i].prescriber_id);
	    } else if (subscriptions[i].prescriber_type === 'groups') {
		groups.push(subscriptions[i].prescriber_id);
	    }
	}

	var query = function(qb) {

	    qb.leftJoin('prescriptions_users', 'prescriptions.id', 'prescriptions_users.prescription_id');
	    qb.leftJoin('prescriptions_groups', 'prescriptions.id', 'prescriptions_groups.prescription_id');

	    qb.where(function() {
		this.where(function() {
		    this.whereIn('prescriber_id', users).whereNull('prescriptions_users.user_id');
		}).orWhere(function() {
		    this.where('prescriptions_users.user_id', req.user.id).whereNull('parent_id');
		}).orWhere(function() {
		    this.whereIn('prescriptions_groups.group_id', groups).whereNull('parent_id');
		});
	    }).whereNotNull('published_at');

	    qb.limit(20);
	    qb.offset(offset);
	    qb.groupBy('prescriptions.id');
	    qb.orderBy('published_at', sort);
	};

	db.model('Prescription').collection().query(query).fetch({
	    withRelated: [
		'prescriber',
		'vitamins',
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
		},
		'users',
		'groups',
		'children',
		'children.prescriber',
		'parent',
		'parent.prescriber'
	    ]
	}).exec(response);
    });
};

var vitamins = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;
    var ids = req.param('ids') || [];
    db.model('Vitamin').collection().query(function(qb) {
	qb.innerJoin('pages_vitamins', 'vitamins.id', 'pages_vitamins.vitamin_id')
	    .innerJoin('subscriptions', 'pages_vitamins.page_id', 'subscriptions.prescriber_id')
	    .where({
		'subscriptions.subscriber_id': req.user.id,
		'subscriptions.prescriber_type': 'pages'
	    }).offset(offset).limit(50).groupBy('id').orderBy('pages_vitamins.created_at', 'desc');

	if (ids.length) qb.whereIn('subscriptions.prescriber_id', ids);
    }).fetch({
	withRelated: [
	    'artists',
	    'hosts',
	    'pages',
	    {
		tags: function(qb) {
		    qb.where('tags.user_id', req.user.id);
		}
	    },
	    {
		craters: function(qb) {
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
    prescriptions: prescriptions,
    vitamins: vitamins,
    all: all
};
