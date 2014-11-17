/* global module, require */

var URI = require('URIjs'),
    config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config);


var load = function(req, res, next) {
    db.model('Page').findOne({
	id: req.param('page')
    }).exec(function(err, page) {
	if (err) {
	    log.error(err, res.locals.logRequest(req));
	    res.status(500).send({
		session: req.user,
		data: err
	    });
	} else if (!page) {
	    res.status(404).send({
		session: req.user,
		data: 'invalid page id: ' + req.param('page')
	    });
	} else {
	    res.locals.page = page;
	    next();
	}
    });
};

var create = function(req, res, next) {
    var text = req.param('url').substring(0, 4) === 'http' ? req.param('url') : ('http://' + req.param('url'));
    var uri = new URI(text).protocol('http').normalize();
    var url = uri.subdomain() === '' ? uri.subdomain('www').toString() : uri.toString();
    db.model('Page').findOrCreate(url, function(err, page) {
	if (err) {

	    if (err !== 'page has no body') {
		var errData = res.locals.logRequest(req);
		errData.page = page;
		log.error(err, errData);
	    }

	    res.status(500).send({
		session: req.user,
		data: err
	    });

	} else {
	    res.locals.page = page;
	    next();
	}
    });
};

var read = function(req, res) {
    db.model('Page').forge({id: res.locals.page.id }).fetch({
	withRelated: [
	    {
		'vitamins': function(qb) {
		    qb.limit(20).orderBy('pages_vitamins.created_at', 'desc');
		}
	    },
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
	    }
	]
    }).exec(function(err, page) {
	var data;

	if (err) log.error(err, res.locals.logRequest(req));
	else {
	    data = page.toJSON();
	    data.crates = data.craters; //deprecated - update chrome ext
	}

	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : data
	});
    });
};

var vitamins = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;

    res.locals.page.vitamins().query(function(qb) {
	qb.limit(20).offset(offset).orderBy('pages_vitamins.created_at', 'desc');
    }).fetch({
	withRelated: [
	    'hosts',
	    'artists',
	    {
		'tags': function(qb) {
		    qb.where('tags.user_id', req.user.id);
		}
	    },
	    {
		'craters': function(qb) {
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
    res.locals.page.related('users').attach(req.user.id).exec(function(err, relation) {
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : relation.toJSON()
	});
    });
};

var untrack = function(req, res) {
    res.locals.page.related('users').detach(req.user.id).exec(function(err, relation) {
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : relation.toJSON()
	});
    });
};

module.exports = {
    load: load,
    create: create,
    read: read,
    vitamins: vitamins,
    track: track,
    untrack: untrack
};
