/* global module, require */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config),
    utils = require('../lib/utils'),
    async = require('async');

var load = function(req, res, next) {
    db.model('User').findOne({
	username: req.param('user')
    }).exec(function(err, user) {
	if (err) {
	    log.error(err, res.locals.logRequest(req));
	    res.send(500, {
		session: req.user,
		data: err
	    });
	} else if (!user) {
	    res.send(404, {
		session: req.user,
		data: 'invalid username: ' + req.param('user')
	    });
	} else {
	    res.locals.user = user;
	    next();
	}
    });
};

var read = function(req, res) {
    res.locals.user.fetch({
	withRelated: [
	    {
		'prescriptions': function(qb) {
		    qb.whereNotNull('published_at').whereNull('recipient_id').limit(20).orderBy('prescriptions.published_at', 'desc');
		}
	    },
	    'prescriptions.prescriber',
	    'prescriptions.vitamins',
	    'prescriptions.vitamins.hosts',
	    {
		'prescriptions.vitamins.crates': function(qb) {
		    qb.where('user_id', req.user.id);
		}
	    }
	]
    }).exec(function(err, user) {
	if (err) log.error(err, res.locals.logRequest(req));
	if (!user) log.error('no user', res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : user.toJSON()
	});
    });
};

var update = function(req, res) {
    db.model('User').edit({
	id: res.locals.user.id,
	name: req.param('name'),
	email: req.param('email'),
	notification: req.param('notification'),
	bio: req.param('bio'),
	location: req.param('location'),
	avatar: req.param('avatar')
    }).exec(function(err, user) {
	var errorMessage, data;
	if (err) {
	    if (err.clientError && err.clientError.message.indexOf('ER_DUP_ENTRY') !== -1) {
		errorMessage = 'Email address is already taken';
	    } else {
		log.error(err, res.locals.logRequest(req));
		errorMessage = 'Failed to save update';
	    }
	} else {
	    data = user.toJSON();
	    data.email = user.attributes.email;
	}
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? errorMessage : data
	});
    });
};

var subscribers = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;
    res.locals.user.fetch({
	withRelated: [
	    {
		'subscribers': function(qb) {
		    //TODO: orderby probably isnt working
		    qb.orderBy('created_at', 'desc').limit(20).offset(offset);
		}
	    }
	]
    }).exec(function(err, user) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : user.toJSON()
	});
    });
};

var prescriptions = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;
    res.locals.user.prescriptions().query(function(qb) {
	qb.whereNotNull('published_at')
	    .whereNull('prescriptions.recipient_id')
	    .orderBy('prescriptions.published_at', 'desc')
	    .limit(20)
	    .offset(offset);
    }).fetch({
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
    }).exec(function(err, user) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : user.toJSON()
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
		    type: 'users',
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
	    db.model('User')
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

    ], function(err, users) {
	if (err) log.error(err, res.locals.logRequest(req));
	var data = err || !users ? err || [] : users.toJSON();

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
    update: update,
    subscribers: subscribers,
    prescriptions: prescriptions,
    browse: browse
};
