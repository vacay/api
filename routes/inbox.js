/* global module, require */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config);

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
		    this.where('prescriptions_users.user_id', req.user.id);
		}).orWhere(function() {
		    this.whereIn('prescriptions_groups.group_id', groups);
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
    vitamins: vitamins
};
