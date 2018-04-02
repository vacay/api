/* global require, module, unescape */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config),
    utils = require('../lib/utils'),
    async = require('async');

var load = function(req, res, next) {
  db.model('Vitamin').findOne({
    id: req.param('vitamin')
  }).asCallback(function(err, vitamin) {
    if (err) {
      log.error(err, res.locals.logRequest(req));
      res.status(500).send({
	session: req.user,
	data: err
      });
    } else if (!vitamin) {
      res.status(404).send({
	session: req.user,
	data: err
      });
    } else {
      res.locals.vitamin = vitamin;
      next();
    }
  });
};

var create = function(req, res, next) {
  var params = {
    id: req.param('id'),
    url: req.param('url'),
    user_id: req.user.id,
    duration: req.param('duration'),
    stream_url: req.param('stream_url'),
    title: req.param('title'),
    host: req.param('host')
  };

  var findOrCreate = function() {
    db.model('Vitamin').findOrCreate(params, function(err, vitamin) {
      if (err || !vitamin) {
	log.error(err, res.locals.logRequest(req));
	res.status(500).send({
	  session: req.user,
	  data: 'failed to create vitamin'
	});
      } else {
	res.locals.vitamin = vitamin;
	next();
      }
    });
  };

  if (!params.id) {
    db.model('Host').parse(params.url, function(err, results) {
      if (err || results.length !== 1) {
	log.error(err, res.locals.logRequest(req));
	res.status(500).send({
	  session: req.user,
	  data: err || (results.length ? 'not a single vitamin' : 'invalid url')
	});
	return;
      }

      var d = results[0];

      params.duration = d.duration;
      params.created_at = d.created_at;
      params.title = d.title;
      params.host = d.host;
      params.stream_url = d.stream_url;
      params.id = d.id;

      findOrCreate();
    });
  } else {
    findOrCreate();
  }
};

var read = function(req, res) {
  var simple = req.param('simple');

  var withRelated = [
    'hosts',
    'artists'
  ];

  if (!simple) {
    withRelated.push(
      'craters',
      'pages',
      'prescriptions',
      'prescriptions.prescriber',
      'prescriptions.vitamins',
      'prescriptions.vitamins.artists',
      'prescriptions.vitamins.hosts',
      'prescriptions.users',
      'prescriptions.groups',
      'prescriptions.votes',
      'prescriptions.votes.user'
    );
  }

  if (req.user) {
    withRelated.push({
      'tags': function(qb) {
	qb.where('tags.user_id', req.user.id);
      }
    });

    if (simple) {
      withRelated.push({
	'craters': function(qb) {
	  qb.where('crates.user_id', req.user.id);
	}
      });
    }
  }

  async.parallel({
    vitamin: function(cb) {
      db.model('Vitamin').forge({
	id: res.locals.vitamin.id
      }).fetch({
	withRelated: withRelated
      }).asCallback(cb);
    },

    prescribers: function(cb) {
      if (simple) {
	cb();
	return;
      }

      db.model('Vitamin').forge({
	id: res.locals.vitamin.id
      }).prescribers().asCallback(cb);
    }

  }, function(err, results) {
    if (err) log.error(err, res.locals.logRequest(req));
    else if (!simple) {
      results.vitamin.set({prescribers: results.prescribers});
    }

    res.status(err ? 500 : 200).send({
      session: req.user,
      data: err ? err : results.vitamin.toJSON()
    });
  });
};

var update = function(req, res) {
  var params = {};

  if (typeof req.param('title') !== 'undefined') params.title = req.param('title');
  if (typeof req.param('original') !== 'undefined') params.original = req.param('original');
  if (typeof req.param('variation') !== 'undefined') params.variation = req.param('variation');

  params.verified_at = new Date();
  params.verified_by = req.user.id;
  params.id = res.locals.vitamin.id;

  async.waterfall([
    function(callback) {
      if (params.title && params.title.length > 100) {
	callback('vitamin title length, ' + params.title.length + ', greater than limit of 100');
      } else {
	callback();
      }
    },

    function(callback) {

      db.model('Vitamin').update(params).asCallback(callback);

    },

    function(vitamin, callback) {
      if (!req.param('original_artists') && !req.param('variation_artists') && !req.param('featured_artists')) {
	callback(null, vitamin);
	return;
      }

      var query = db.knex('artists_vitamins').where('vitamin_id', vitamin.id).del();

      query.asCallback(function(err) {
	callback(err, vitamin);
      });
    },

    function(vitamin, callback) {
      if (!req.param('original_artists') && !req.param('variation_artists') && !req.param('featured_artists')) {
	callback(null, vitamin);
	return;
      }

      var original_artists = [];
      var featured_artists = [];
      var variation_artists = [];

      // lets figure this out a better way
      var isVariation = req.param('isVariation');

      if (req.param('original_artists')) {
	original_artists = req.param('artists');
	if (!Array.isArray(original_artists)) original_artists = [original_artists];

	for (var i=0; i<original_artists.length; i++) {
	  original_artists[i].type = 'Original';
	  original_artists[i].attributed = !isVariation;
	}
      }

      if (req.param('variation_artists')) {
	variation_artists = req.param('variation_artists');
	if (!Array.isArray(variation_artists)) variation_artists = [variation_artists];
	for (var i=0; i<variation_artists.length; i++) {
	  variation_artists[i].type = 'Variation';
	  variation_artists[i].attributed = isVariation;
	}
      }

      if (req.param('featured_artists')) {
	featured_artists = req.param('featured_artists');
	if (!Array.isArray(featured_artists)) featured_artists = [featured_artists];
	for (var i=0; i<featured_artists.length; i++) {
	  featured_artists[i].type = 'Featured';
	  featured_artists[i].attributed = !isVariation;
	}
      }

      var artists = original_artists.concat(variation_artists, featured_artists);

      res.locals.vitamin.related('artists').attach(artists).asCallback(function(err) {
	callback(err, vitamin);
      });
    }

  ], function(err, vitamin) {
    if (err) log.error(err, res.locals.logRequest(req));
    res.status(err ? 500 : 200).send({
      session: req.user,
      data: err ? err : vitamin.toJSON()
    });
  });
};

var browse = function(req, res) {
  var offset = parseInt(req.param('offset'), 10) || 0;
  var limit = parseInt(req.param('limit'), 10) || 10;

  if (limit < 0 || limit > 20) limit = 20;

  var query = req.param('q') ? unescape(req.param('q')) : null;
  var ids = req.param('ids') || [];

  if (ids.length > 50) {
    res.status(400).send({
      session: req.user,
      data: 'too many ids'
    });
    return;
  }

  var updated_at = req.param('updated_at') || null;
  var subscription_ids = req.param('subscription_ids') || [];
  subscription_ids = Array.isArray(subscription_ids) ? subscription_ids : [subscription_ids];

  async.waterfall([
    function(callback) {
      if (query) {
	res.locals.es.search({
	  index: 'vcy',
	  type: 'vitamins',
	  q: utils.escape(query),
	  size: limit,
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
	for(var i=0; i<hits.length; i++) {
	  ids.push(hits[i]._source.id);
	}
	if (!ids.length) {
	  callback(null, null);
	  return;
	}
      }

      if (ids && !Array.isArray(ids)) ids = [ids];

      var withRelated = ['artists','hosts'];

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

      db.model('Vitamin')
	.collection()
	.query(function(qb) {
	  if (ids.length) {
	    qb.whereIn('id', ids);
	  } else {
	    qb.limit(limit).offset(offset);
	  }

	  if (subscription_ids.length) {
	    qb.select(db.knex.raw('vitamins.*, crates.created_at as published_at'));
	    qb.innerJoin('crates', 'vitamins.id', 'crates.vitamin_id');
	    qb.whereIn('crates.user_id', subscription_ids);
	    qb.orderBy('crates.created_at', 'desc');
	    withRelated.push({
	      'publishers': function(qb) {
		qb.whereIn('users.id', subscription_ids);
	      }
	    });
	  } else {
	    qb.orderBy('vitamins.created_at', 'desc');
	  }

	  if (updated_at) qb.andWhere('vitamins.updated_at', '>', updated_at);
	}).fetch({
	  withRelated: withRelated
	}).asCallback(callback);
    }

  ], function(err, vitamins) {

    var data = [];

    if (err) log.error(err, res.locals.logRequest(req));
    else {
      data = !vitamins ? [] : vitamins.toJSON();

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

var destroy = function(req, res) {
  res.locals.vitamin.destroy().asCallback(function(err, result) {
    if (err) log.error(err, res.locals.logRequest(req));
    res.status(err ? 500 : 200).send({
      session: req.user,
      data: err ? err : result
    });
  });
};

var stream = function(req, res) {
  var query = db.knex('hosts').where('vitamin_id', res.locals.vitamin.id).select();
  query.asCallback(function(err, hosts) {
    if (err) {
      log.error(err, res.locals.logRequest(req));
      res.status(500).send({
	session: req.user,
	data: err
      });
      return;
    }

    var update = function(host, next) {
      if (!host.stream_url || (host.title === 'youtube' || host.title === 'soundcloud')) {
	db.model('Host').parse(host.url, function(err, results) {
	  if (!err) host.stream_url = results[0].stream_url;
	  next();
	});
      } else {
	next();
      }
    };

    async.each(hosts, update, function() {
      res.status(200).send({
	session: req.user,
	data: hosts
      });
    });
  });
};

module.exports = {
  load: load,
  create: create,
  read: read,
  update: update,
  destroy: destroy,
  stream: stream,
  browse: browse
};
