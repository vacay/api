/* global module, require, unescape */

var config = require('config-api'),
    async = require('async'),
    log = require('log')(config.log),
    db = require('db')(config);

var load = function(req, res, next) {
    db.model('Artist').findOne({
	id: req.param('artist')
    }).exec(function(err, artist) {
	if (err) {
	    log.error(err, res.locals.logRequest(req));
	    res.status(500).send({
		session: req.user,
		data: err
	    });
	} else if (!artist) {
	    res.status(404).send({
		session: req.user,
		data: 'invalid artist id: ' + req.param('artist')
	    });
	} else {
	    res.locals.artist = artist;
	    next();
	}
    });
};

var read = function(req, res) {
    db.model('Artist').forge({
	id: res.locals.artist.id
    }).fetch({
	withRelated: [
	    {
		'vitamins': function(qb) {
		    qb.limit(20);
		}
	    },
	    'vitamins.hosts',
	    'vitamins.artists',
	    {
		'vitamins.tags': function(qb) {
		    qb.where('tags.user_id', req.user.id);
		}
	    },
	    'vitamins.craters'
	]
    }).exec(function(err, artist) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : artist.toJSON()
	});
    });
};

var vitamins = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;
    var query = req.param('q') ? unescape(req.param('q')) : null;

    res.locals.artist.vitamins().query(function(qb) {
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
	qb.limit(20).offset(offset);
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

var originals = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;
    var query = req.param('q') ? unescape(req.param('q')) : null;

    res.locals.artist.originals().query(function(qb) {
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
	qb.limit(20).offset(offset);
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

var variations = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;
    var query = req.param('q') ? unescape(req.param('q')) : null;

    res.locals.artist.variations().query(function(qb) {
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
	qb.limit(20).offset(offset);
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

var browse = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;
    var query = req.param('q') ? unescape(req.param('q')) : null;
    var ids = req.param('ids') || [];

    async.waterfall([

	function(callback) {
	    if (query) {
		res.locals.es.search({
		    index: 'vcy',
		    type: 'artists',
		    q: query,
		    size: 10,
		    from: offset
		}, callback);
	    } else {
		callback(null, null, null);
	    }
	},

	function(search, status, callback) {
	    if (search) {
		ids = [];
		var hits = search.hits.hits;
		for (var i=0; i<hits.length; i++) {
		    ids.push(hits[i]._source.id);
		}
		if (!ids.length) {
		    callback(null, null);
		    return;
		}

		if (ids && !Array.isArray(ids)) ids = [ids];

		db.model('Artist').collection().query(function(qb) {
		    if (ids.length) {
			qb.whereIn('id', ids);
		    } else {
			qb.limit(10)
			    .offset(offset)
			    .orderBy('created_at', 'desc');
		    }
		}).fetch().exec(callback);
	    }
	}
    ], function(err, artists) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : artists.toJSON()
	});
    });
};

var subscribe = function(req, res) {
    res.locals.artist.related('users').attach(req.user.id).exec(function(err, relation) {
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : relation.toJSON()
	});
    });
};

var unsubscribe = function(req, res) {
    res.locals.artist.related('users').detach(req.user.id).exec(function(err, relation) {
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : relation.toJSON()
	});
    });
};

module.exports = {
    load: load,
    read: read,
    vitamins: vitamins,
    originals: originals,
    variations: variations,
    browse: browse,
    subscribe: subscribe,
    unsubscribe: unsubscribe
};
