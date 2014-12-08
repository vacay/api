/* global module, require, unescape */

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
	    res.status(500).send({
		session: req.user,
		data: err
	    });
	} else if (!user) {
	    res.status(404).send({
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
		    qb.whereNotNull('published_at').limit(20).orderBy('prescriptions.published_at', 'desc');
		}
	    },
	    'prescriptions.prescriber',
	    'prescriptions.vitamins',
	    'prescriptions.vitamins.artists',
	    'prescriptions.vitamins.hosts',
	    {
		'prescriptions.vitamins.tags': function(qb) {
		    qb.where('tags.user_id', req.user.id);
		}
	    },
	    {
		'prescriptions.vitamins.craters': function(qb) {
		    qb.where('crates.user_id', req.user.id);
		}
	    },
	    'prescriptions.users',
	    'prescriptions.groups',
	    'prescriptions.parent',
	    'prescriptions.parent.prescriber',
	    'prescriptions.children',
	    'prescriptions.children.prescriber'
	]
    }).exec(function(err, user) {
	if (err) log.error(err, res.locals.logRequest(req));
	if (!user) log.error('no user', res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : user.toJSON()
	});
    });
};

var update = function(req, res) {

    var params = {};

    if (typeof req.param('name') !== 'undefined') params.name = req.param('name');
    if (typeof req.param('email') !== 'undefined') params.email = req.param('email');
    if (typeof req.param('notification') !== 'undefined') params.notification = req.param('notification');
    if (typeof req.param('public_crate') !== 'undefined') params.public_crate = req.param('public_crate');
    if (typeof req.param('bio') !== 'undefined') params.bio = req.param('bio');
    if (typeof req.param('location') !== 'undefined') params.location = req.param('location');
    if (typeof req.param('avatar') !== 'undefined') params.avatar = req.param('avatar');

    params.id = res.locals.user.id;

    db.model('User').edit(params).exec(function(err, user) {
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
	res.status(err ? 500 : 200).send({
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
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : user.toJSON()
	});
    });
};

var prescriptions = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;
    var query = req.param('q') ? unescape(req.param('q')) : null;


    res.locals.user.prescriptions().query(function(qb) {
	if (query) {
	    qb.where('prescriptions.description', 'LIKE', '%' + query + '%');
	}
	qb.whereNotNull('published_at')
	    .orderBy('prescriptions.published_at', 'desc')
	    .limit(20)
	    .offset(offset);
    }).fetch({
	withRelated: [
	    'prescriber',
	    'vitamins',
	    'vitamins.artists',
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
	    'parent',
	    'parent.prescriber',
	    'children',
	    'children.prescriber'
	]
    }).exec(function(err, user) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : user.toJSON()
	});
    });
};

var pages = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;

    res.locals.user.pages().query({
	limit: 20,
	offset: offset
    }).fetch().exec(function(err, pages) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : pages.toJSON()
	});
    });
};

var crate = function(req, res) {

    if (!res.locals.user.attributes.public_crate && req.user.id !== res.locals.user.id) {
	res.status(401).send({
	    session: req.user,
	    data: 'unauthorized access to private crate'
	});
	return;
    }

    var offset = parseInt(req.param('offset'), 10) || 0;
    var query = req.param('q') ? unescape(req.param('q')) : null;
    var tags = req.param('tags') || [];

    tags = Array.isArray(tags) ? tags : [tags];

    res.locals.user.crate().query(function(qb) {
	if (tags.length) {
	    qb.innerJoin('tags', 'vitamins.id', 'tags.vitamin_id')
		.where('tags.user_id', res.locals.user.id)
		.whereIn('tags.value', tags)
		.havingRaw('COUNT(DISTINCT tags.value) = ?', tags.length);
	}

	if (query) {
	    qb.where(function() {
		var terms = query.split(' ');
		for (var i=0; i<terms.length; i++) {
		    if (i === 0) {
			this.where('vitamins.title', 'LIKE', '%' + terms[i] + '%');
		    } else {
			this.orWhere('vitamins.title', 'LIKE', '%' + terms[i] + '%');
		    }
		}
	    });
	}
	qb.limit(50).offset(offset).groupBy('vitamins.id').orderBy('crates.created_at', 'desc');
    }).fetch({
	withRelated: [
	    'artists',
	    'hosts',
	    {
		'craters': function(qb) {
		    qb.where('crates.user_id', req.user.id);
		}
	    },
	    {
		'tags': function(qb) {
		    qb.where('tags.user_id', req.user.id);
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
		    q: utils.escape(query),
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
	    db.model('User')
		.collection()
		.query(function(qb) {
		    if (ids.length) {
			qb.whereIn('id', ids);
		    } else {
			qb.limit(10)
			    .offset(offset)
			    .orderBy('created_at', 'desc');
		    }
		}).fetch().exec(callback);
	}

    ], function(err, users) {

	var data = [];

	if (err) log.error(err, res.locals.logRequest(req));
	else {
	    data = !users ? [] : users.toJSON();

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

var tags = function(req, res) {
    res.locals.user.tags().fetch().exec(function(err, tags) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : tags.toJSON()
	});
    });
};

module.exports = {
    load: load,
    read: read,
    update: update,
    subscribers: subscribers,
    prescriptions: prescriptions,
    pages: pages,
    crate: crate,
    browse: browse,
    tags: tags
};
