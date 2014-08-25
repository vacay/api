/* global module, require */

var config = require('config-api'),
    async = require('async'),
    log = require('log')(config.log),
    db = require('db')(config);

var load = function(req, res, next) {
    db.model('Group').findOne({
	id: req.param('group')
    }).exec(function(err, group) {
	if (err) {
	    log.error(err, res.locals.logRequest(req));
	    res.send(500, {
		session: req.user,
		data: err
	    });
	} else if (!group) {
	    res.send(404, {
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
	    }).exec(function(err, relation) {
		callback(err, group, relation);
	    });
	}
    ], function(err, group, relation) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err || (!group ? [] : group.toJSON())
	});
    });
};

var read = function(req, res) {
    res.locals.group.fetch({
	withRelated: [
	    'admins',
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
    }).exec(function(err, group) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err || (!group ? [] : group.toJSON())
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
		}).fetch().exec(callback);
	}

    ], function(err, groups) {
	if (err) log.error(err, res.locals.logRequest(req));
	var data = err || (!groups ? [] : groups.toJSON());

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
    create: create,
    read: read,
    browse: browse
};
