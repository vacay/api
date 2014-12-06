/* global module, require, unescape */

var config = require('config-api'),
    async = require('async'),
    log = require('log')(config.log),
    utils = require('../lib/utils'),
    db = require('db')(config);

var load = function(req, res, next) {
    db.model('Group').findOne({
	id: req.param('group')
    }).exec(function(err, group) {
	if (err) {
	    log.error(err, res.locals.logRequest(req));
	    res.status(500).send({
		session: req.user,
		data: err
	    });
	} else if (!group) {
	    res.status(404).send({
		session: req.user,
		data: 'invalid group id: ' + req.param('group')
	    });
	} else {
	    res.locals.group = group;
	    next();
	}
    });
};

var create = function(req, res) {
    async.waterfall([
	function(callback) {
	    db.model('Group').create({
		name: req.param('name'),
		description: req.param('description')
	    }).exec(callback);
	},

	function(group, callback) {
	    group.admins().attach({
		user_id: req.user.id,
		created_at: new Date(),
		access: 'admin'
	    }).exec(function(err) {
		callback(err, group);
	    });
	}
    ], function(err, group) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : group.toJSON()
	});
    });
};

var update = function(req, res) {
    db.knex('groups_users').select().where({
	user_id: req.user.id,
	group_id: res.locals.group.id
    }).exec(function(err, users) {
	if (err) log.error(err, res.locals.logRequest(req));

	if (users && users.length) {

	    db.model('Group').edit({
		id: res.locals.group.id,
		name: req.param('name'),
		description: req.param('description')
	    }).exec(function(err, group) {
		if (err) log.error(err, res.locals.logRequest(req));
		res.send(err ? 500 : 200, {
		    session: req.user,
		    data: err ? err : group.toJSON()
		});
	    });

	} else {
	    res.send(403, {
		message: 'not authorized to modify group: ' + res.locals.group.id,
		session: req.user
	    });
	}
    });
};

var read = function(req, res) {
    res.locals.group.fetch({
	withRelated: [
	    'admins',
	    'pages',
	    'prescriptions',
	    'prescriptions.prescriber',
	    'prescriptions.vitamins',
	    'prescriptions.vitamins.artists',
	    'prescriptions.vitamins.hosts',
	    {
		'prescriptions.vitamins.craters': function(qb) {
		    qb.where('crates.user_id', req.user.id);
		}
	    },
	    {
		'prescriptions.vitamins.tags': function(qb) {
		    qb.where('tags.user_id', req.user.id);
		}
	    },
	    'prescriptions.users',
	    'prescriptions.groups',
	    'prescriptions.parent',
	    'prescriptions.parent.prescriber',
	    'prescriptions.children',
	    'prescriptions.children.prescriber'

	]
    }).exec(function(err, group) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : group.toJSON()
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
		    type: 'groups',
		    q: query,
		    size: 5
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
	    db.model('Group')
		.collection()
		.query(function(qb) {
		    if (ids.length) {
			qb.whereIn('id', ids);
		    } else {
			qb.limit(20)
			    .offset(offset)
			    .orderBy('created_at', 'desc');
		    }
		}).fetch({
		    withRelated: [
			'admins',
			'pageCount',
			'prescriptionCount'
		    ]
		}).exec(callback);
	}

    ], function(err, groups) {

	var data = [];

	if (err) log.error(err, res.locals.logRequest(req));
	else {
	    data = !groups ? [] : groups.toJSON();

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

var tracker = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;
    db.model('Vitamin').collection().query(function(qb) {
	qb.innerJoin('pages_vitamins', 'vitamins.id', 'pages_vitamins.vitamin_id')
	    .innerJoin('groups_pages', 'pages_vitamins.page_id', 'groups_pages.page_id')
	    .where('groups_pages.group_id', res.locals.group.id)
	    .offset(offset)
	    .limit(50)
	    .groupBy('id')
	    .orderBy('pages_vitamins.created_at', 'desc');
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

var track = function(req, res) {
    res.locals.group.related('pages').attach({
	page_id: res.locals.page.id,
	created_at: new Date()
    }).exec(function(err, relation) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : relation.toJSON()
	});
    });
};

var untrack = function(req, res) {
    res.locals.group.related('pages').detach(res.locals.page.id).exec(function(err, relation) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : relation.toJSON()
	});
    });
};


module.exports = {
    load: load,
    create: create,
    update: update,
    tracker: tracker,
    track: track,
    untrack: untrack,
    read: read,
    browse: browse
};
