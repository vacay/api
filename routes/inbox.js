/* global module, require */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config),
    async = require('async');

var index = function(req, res) {
    var ids = req.param('ids') || [];
    var limit = parseInt(req.param('limit'), 10) || 50;
    var last_vitamin = parseInt(req.param('lv'), 10) || 0;

    if (limit < 0 || limit > 50) limit = 50;

    var user_id = 1;
    var withRelated = [
	'artists',
	'hosts',
	'pages'
    ];

    if (req.user) {
	user_id = req.user.id;
	withRelated.push({
	    tags: function(qb) {
		qb.where('tags.user_id', req.user.id);
	    }
	},{
	    craters: function(qb) {
		qb.where('crates.user_id', req.user.id);
	    }
	});
    }

    var query = function(qb) {
	qb.select(db.knex.raw('vitamins.*, MAX(pages_vitamins.created_at) as published_at, pages_vitamins.id as join_id, pages_vitamins.page_id as page_id'));
	qb.innerJoin('pages_vitamins', 'vitamins.id', 'pages_vitamins.vitamin_id');
	qb.innerJoin('subscriptions', 'pages_vitamins.page_id', 'subscriptions.prescriber_id');
	qb.where({
	    'subscriptions.subscriber_id': user_id,
	    'subscriptions.prescriber_type': 'pages'
	});

	if (last_vitamin) qb.where('pages_vitamins.id', '<', last_vitamin);
	if (ids.length) qb.whereIn('subscriptions.prescriber_id', ids);

	qb.limit(limit);
	qb.groupBy('pages_vitamins.id');
	qb.orderByRaw('pages_vitamins.id DESC');
    };

    db.model('Vitamin').collection().query(query).fetch({
	withRelated: withRelated
    }).asCallback(function(err, vitamins) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : vitamins.toJSON()
	});
    });
};

module.exports = {
    index: index
};
