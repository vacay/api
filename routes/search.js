var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config),
    request = require('requestretry'),
    utils = require('../lib/utils'),
    async = require('async');

var youtube = function(req, res) {
    var q = req.param('q');
    var offset = req.param('offset') || 0;

    var options = {
	search_query: q,
	filters: 'video',
	page: Math.floor(offset / 20) + 1
    };

    request({
	url: 'http://www.youtube.com/results',
	qs: options,
	maxAttempts: 2,
	rejectUnauthorized: false
    }, function(e, r, body) {

	var content_html = body;
	var ids = [];

	var ytRE = /href="\s*\/watch\?v=([0-9A-Za-z_-]{11})/ig;
	var match = ytRE.exec(content_html);    
	while(match !== null) {
	    if (ids.indexOf(match[1]) === -1) ids.push(match[1]);
	    match = ytRE.exec(content_html);
	}

	var getInfo = function(id, next) {
	    db.model('Host').parse('http://www.youtube.com/watch?v=' + id, function(err, results) {
		if (!err) next(null, results.length ? results[0] : null);
	    });
	};

	async.mapLimit(ids, 5, getInfo, function(err, videos) {
	    res.status(200).send({
		session: req.user,
		data: videos
	    });
	});

    });
};

var count = function(req, res) {
    var query = req.param('q') ? unescape(req.param('q')) : null;

    async.series({
	prescriptions: function(next) {
	    res.locals.es.count({
		index: 'vcy',
		type: 'prescriptions',
		q: utils.escape(query)
	    }, next);
	},
	vitamins: function(next) {
	    res.locals.es.count({
		index: 'vcy',
		type: 'vitamins',
		q: utils.escape(query)
	    }, next);
	},
	pages: function(next) {
	    res.locals.es.count({
		index: 'vcy',
		type: 'pages',
		q: utils.escape(query)
	    }, next);
	},
	users: function(next) {
	    res.locals.es.count({
		index: 'vcy',
		type: 'users',
		q: utils.escape(query)
	    }, next);
	},
	artists: function(next) {
	    res.locals.es.count({
		index: 'vcy',
		type: 'artists',
		q: utils.escape(query)
	    }, next);
	}
    }, function(err, result) {
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : result
	});
    });

};

var top = function(req, res) {
    var query = req.param('q') ? unescape(req.param('q')) : null;
    var limit = parseInt(req.param('limit'), 10) || 10;

    async.waterfall([
	function(cb) {
	    res.locals.es.search({
		size: limit,
		from: 0,
		body: {
		    query: {
			multi_match: {
			    query: utils.escape(query),
			    fields: [
				'artists.name^2',
				'pages.title^2',
				'pages.url',
				'vitamins.title^2',
				'users.username^3',
				'users.name^3',
				'users.location',
				'prescriptions.description',
				'prescriptions.vitamins.title',
				'users.bio',
				'users.email^2'
			    ]
			}
		    }
		}
	    }, cb);
	},

	function(search, status, cb) {
	    var types = {
		artists: [],
		prescriptions: [],
		users: [],
		pages: [],
		vitamins:[]
	    };
	    var results = {};

	    search.hits.hits.forEach(function(i) {
		types[i._type].push(i._id);
	    });

	    var iterator = function(item, key, next) {
		if (item.length) {

		    var finish = function(err, result) {
			results[key] = result;
			next(err);
		    };

		    var model = key[0].toUpperCase() + key.slice(1, -1);
		    var query = db.model(model).collection().query(function(qb) {
			qb.whereIn('id', item);
		    });

		    var withRelated;

		    switch(key) {

		    case 'prescriptions':
			withRelated = [
			    'prescriber',
			    'vitamins',
			    'vitamins.artists',
			    'vitamins.hosts',
			    'users',
			    'groups',
			    'votes',
			    'votes.user'
			];

			if (req.user) {
			    withRelated.push({
				'vitamins.tags': function(qb) {
				    qb.where('tags.user_id', req.user.id);
				}
			    },{
				'vitamins.craters': function(qb) {
				    qb.where('crates.user_id', req.user.id);
				}
			    });
			}

			query.fetch({
			    withRelated: withRelated
			}).asCallback(finish);
			break;

		    case 'vitamins':
			withRelated = ['artists','hosts'];

			if (req.user) {
			    withRelated.push({
				'tags': function(qb) {
				    qb.where('tags.user_id', req.user.id);
				}
			    },{
				'craters': function(qb) {
				    qb.where('crates.user_id', req.user.id);
				}
			    });
			}

			query.fetch({
			    withRelated: withRelated
			}).asCallback(finish);
			break;

		    case 'pages':
			query.fetch({ withRelated: [ 'vitaminCount' ] }).asCallback(finish);
			break;

		    case 'users':
			query.fetch({
			    withRelated: [
				'prescriptionCount',
				'crateCount'
			    ]
			}).asCallback(finish);
			break;

		    case 'artists':
			query.fetch().asCallback(finish);
			break;
		    }
		} else {
		    next();
		}
	    };

	    async.forEachOf(types, iterator, function(err) {
		if (err) {
		    cb(err, []);
		    return;
		}

		var result = [];
		for(var i=0; i <search.hits.hits.length; i++) {
		    result.push(results[search.hits.hits[i]._type].find(function(v) {
			return v.id == search.hits.hits[i]._id;
		    }));
		}
		cb(null, result);
	    });
	}
    ], function(err, result) {
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : result
	});
    });
};

module.exports = {
    youtube: youtube,
    count: count,
    top: top
};
