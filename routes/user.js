/* global module, require, unescape */

var moment = require('moment'),
    config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config),
    utils = require('../lib/utils'),
    async = require('async'),
    jwt = require('jsonwebtoken');

var load = function(req, res, next) {
  db.model('User').findOne({
    username: req.param('user')
  }).asCallback(function(err, user) {
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

var create = function(req, res) {
  db.model('User').findOrCreate({
    email: req.param('email')
  }, function(err, user) {
    if (err) log.error(err, res.locals.logRequest(req));
    res.status(err ? 500 : 200).send({
      session: req.user,
      data: err ? err : user.toJSON()
    });
  });
};

var read = function(req, res) {
  res.locals.user.fetch({
    withRelated: [
      'prescriptionCount',
      'recommendationCount',
      'crateCount',
      'listenCount',
      'importCount',
      'draftCount',
      'pageCount',
      'userCount',
      'tagCount'
    ]
  }).asCallback(function(err, user) {
    if (err) log.error(err, res.locals.logRequest(req));
    if (!user) log.error('no user', res.locals.logRequest(req));
    res.status(err ? 500 : 200).send({
      session: req.user,
      data: err ? err : user.toJSON()
    });
  });
};

var summary = function(req, res) {
  var withRelated = [
    {
      'recommended': function(qb) {
	qb.limit(2);
      }
    },
    'recommended.prescriber',
    'recommended.vitamins',
    'recommended.vitamins.artists',
    'recommended.vitamins.hosts',
    'recommended.users',
    'recommended.groups',
    'recommended.votes',
    'recommended.votes.user',
    {
      'recommendations': function(qb) {
	qb.limit(2).orderBy('prescriptions.published_at', 'desc');
      }
    },
    'recommendations.prescriber',
    'recommendations.vitamins',
    'recommendations.vitamins.artists',
    'recommendations.vitamins.hosts',
    'recommendations.users',
    'recommendations.groups',
    'recommendations.votes',
    'recommendations.votes.user'
  ];

  if (req.user) {
    withRelated.push({
      'recommended.vitamins.tags': function(qb) {
	qb.where('tags.user_id', req.user.id);
      }
    },{
      'recommended.vitamins.craters': function(qb) {
	qb.where('crates.user_id', req.user.id);
      }
    },{
      'recommendations.vitamins.tags': function(qb) {
	qb.where('tags.user_id', req.user.id);
      }
    },{
      'recommendations.vitamins.craters': function(qb) {
	qb.where('crates.user_id', req.user.id);
      }
    });
  }

  if (res.locals.user.attributes.public_crate || (req.user && req.user.id === res.locals.user.id)) {
    withRelated.push({
      'crate': function(qb) {
	qb.limit(5).orderBy('crates.created_at', 'desc');
      }
    }, 'crate.artists', 'crate.hosts');

    if (req.user) {
      withRelated.push({
	'crate.craters': function(qb) {
	  qb.where('crates.user_id', req.user.id);
	}
      }, {
	'crate.tags': function(qb) {
	  qb.where('tags.user_id', req.user.id);
	}
      });
    }
  }

  res.locals.user.fetch({
    withRelated: withRelated
  }).asCallback(function(err, user) {
    if (err) log.error(err, res.locals.logRequest(req));
    if (!user) log.error('no user', res.locals.logRequest(req));
    res.status(err ? 500 : 200).send({
      session: req.user,
      data: err ? err : user.toJSON()
    });
  });
};

var recommended = function(req, res) {
  var offset = parseInt(req.param('offset'), 10) || 0;
  var limit = parseInt(req.param('limit'), 10) || 20;

  var withRelated = [
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

  res.locals.user.recommended().query(function(qb) {
    qb.limit(limit);
    qb.offset(offset);
  }).fetch({
    withRelated: withRelated
  }).asCallback(function(err, user) {
    if (err) log.error(err, res.locals.logRequest(req));
    if (!user) log.error('no user', res.locals.logRequest(req));
    res.status(err ? 500 : 200).send({
      session: req.user,
      data: err ? err : user.toJSON()
    });
  });
};

var recommendations = function(req, res) {
  var offset = parseInt(req.param('offset'), 10) || 0;
  var limit = parseInt(req.param('limit'), 10) || 20;

  var withRelated = [
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

  res.locals.user.recommendations().query(function(qb) {
    qb.offset(offset).limit(limit).orderBy('prescriptions.published_at', 'desc');
  }).fetch({
    withRelated: withRelated
  }).asCallback(function(err, user) {
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

  if (typeof req.param('name') !== 'undefined')
    params.name = req.param('name');

  if (typeof req.param('email') !== 'undefined')
    params.email = req.param('email');

  if (typeof req.param('notification') !== 'undefined')
    params.notification = !!req.param('notification');

  if (typeof req.param('public_crate') !== 'undefined')
    params.public_crate = !!req.param('public_crate');

  if (typeof req.param('public_listens') !== 'undefined')
    params.public_listens = !!req.param('public_listens');

  if (typeof req.param('bio') !== 'undefined')
    params.bio = req.param('bio');

  if (typeof req.param('location') !== 'undefined')
    params.location = req.param('location');

  if (typeof req.param('avatar') !== 'undefined')
    params.avatar = req.param('avatar');

  if (typeof req.param('username') !== 'undefined')
    params.username = req.param('username');

  if (typeof req.param('activity') !== 'undefined')
    params.activity = req.param('activity');

  params.id = res.locals.user.id;

  db.model('User').edit(params).asCallback(function(err, user) {
    var errorMessage, data, token;
    if (err) {
      if (err.message && err.message.indexOf('ER_DUP_ENTRY') !== -1) {
	if (err.message.indexOf('users_email_unique') !== -1) errorMessage = 'Email address is taken';
	if (err.message.indexOf('users_username_unique') !== -1) errorMessage = 'Username is taken';
      }

      if (err.errors) errorMessage = err.toString().substring(17);

      if (!errorMessage) errorMessage = 'Failed to save update';

      log.error(err);
    } else {
      data = user.toJSON();
      data.email = user.attributes.email;

      if (data.username) {
	var opts = {}
	var previousUsername = req.user.username;
	req.user.username = data.username;

	if (!req.user.exp)
	  opts.expiresIn = config.session.expires

	token = jwt.sign(req.user, config.session.secret, opts);

	db.knex('tags').update({
	  value: '@' + data.username
	}).where({
	  value: '@' + previousUsername
	}).asCallback(function(err) {
	  if (err) log.error(err);
	});

	res.locals.redis.keys('u:' + previousUsername + ':*', function(err, keys) {
	  if (err) log.error(err);
	  else {
	    var rename = function(key, done) {
	      var newKey = key.replace(previousUsername, data.username);
	      res.locals.redis.renamenx(key, newKey, done);
	    };
	    async.each(keys, rename, function(err) {
	      if (err) log.error(err);
	    });
	  }
	});
      }
    }
    //TODO - certain errors are 400
    res.status(err ? 500 : 200).send({
      session: req.user,
      data: err ? errorMessage : data,
      token: token
    });
  });
};

var destroy = function(req, res) {
  if (res.locals.user.id !== req.user.id) {
    res.status(401).send({
      session: req.user,
      data: 'unauthorized access'
    });
    return;
  }

  res.locals.user.destroy().asCallback(function(err, result) {
    if (err) log.error(err, res.locals.logRequest(req));
    res.status(err ? 500 : 200).send({
      session: req.user,
      data: err ? err : result.toJSON()
    });
  });
};

var prescriptions = function(req, res) {
  var offset = parseInt(req.param('offset'), 10) || 0;
  var limit = parseInt(req.param('limit'), 10) || 20;

  if (limit < 0 || limit > 20) limit = 20;

  var query = req.param('q') ? unescape(req.param('q')) : null;

  var withRelated = [
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

  res.locals.user.prescriptions().query(function(qb) {
    if (query) {
      qb.where('prescriptions.description', 'LIKE', '%' + query + '%');
    }
    qb.whereNotNull('published_at')
      .orderBy('prescriptions.published_at', 'desc')
      .limit(limit)
      .offset(offset);
  }).fetch({
    withRelated: withRelated
  }).asCallback(function(err, user) {
    if (err) log.error(err, res.locals.logRequest(req));
    res.status(err ? 500 : 200).send({
      session: req.user,
      data: err ? err : user.toJSON()
    });
  });
};

var pages = function(req, res) {
  var offset = parseInt(req.param('offset'), 10) || 0;
  var limit = parseInt(req.param('limit'), 10) || 20;

  if (limit < 0 || limit > 20) limit = 20;

  res.locals.user.pages().query(function(qb) {
    qb.orderBy('subscriptions.created_at').limit(limit).offset(offset);
  }).fetch().asCallback(function(err, pages) {
    if (err) log.error(err, res.locals.logRequest(req));
    res.status(err ? 500 : 200).send({
      session: req.user,
      data: err ? err : pages.toJSON()
    });
  });
};

var users = function(req, res) {
  var offset = parseInt(req.param('offset'), 10) || 0;
  var limit = parseInt(req.param('limit'), 10) || 20;

  if (limit < 0 || limit > 20) limit = 20;

  res.locals.user.users().query(function(qb) {
    qb.orderBy('subscriptions.created_at').limit(limit).offset(offset);
  }).fetch().asCallback(function(err, users) {
    if (err) log.error(err, res.locals.logRequest(req));
    res.status(err ? 500 : 200).send({
      session: req.user,
      data: err ? err : users.toJSON()
    });
  });
};

var listens = function(req, res) {
  var isUser = req.user && req.user.id === res.locals.user.id;

  if (!res.locals.user.attributes.public_listens && isUser) {
    res.status(401).send({
      session: req.user,
      data: 'unauthorized access to private listening history'
    });
    return;
  }

  var offset = parseInt(req.param('offset'), 10) || 0;
  var limit = parseInt(req.param('limit'), 10) || 20;

  if (limit < 0 || limit > 20) limit = 20;

  var query = req.param('q') ? unescape(req.param('q')) : null;

  var q = res.locals.user.listens();

  if (isUser) q.withPivot(['user_agent', 'ip_address']);

  var withRelated = ['artists','hosts'];

  if (req.user) {
    withRelated.push({
      'craters': function(qb) {
	qb.where('crates.user_id', req.user.id);
      }
    },{
      'tags': function(qb) {
	qb.where('tags.user_id', req.user.id);
      }
    });
  }

  q.query(function(qb) {

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

    qb.orderBy('listens.created_at', 'desc').limit(limit).offset(offset);
  }).fetch({
    withRelated: withRelated
  }).asCallback(function(err, vitamins) {
    if (err) log.error(err, res.locals.logRequest(req));
    res.status(err ? 500 : 200).send({
      session: req.user,
      data: err ? err : vitamins.toJSON()
    });
  });
};

var imports = function(req, res) {
  var offset = parseInt(req.param('offset'), 10) || 0;
  var limit = parseInt(req.param('limit'), 10) || 20;

  if (limit < 0 || limit > 20) limit = 20;

  var query = req.param('q') ? unescape(req.param('q')) : null;

  var q = res.locals.user.imports();

  var withRelated = ['artists','hosts'];

  if (req.user) {
    withRelated.push({
      'craters': function(qb) {
	qb.where('crates.user_id', req.user.id);
      }
    },{
      'tags': function(qb) {
	qb.where('tags.user_id', req.user.id);
      }
    });
  }

  q.query(function(qb) {

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

    qb.orderBy('vitamins.created_at', 'desc').limit(limit).offset(offset);
  }).fetch({
    withRelated: withRelated
  }).asCallback(function(err, vitamins) {
    if (err) log.error(err, res.locals.logRequest(req));
    res.status(err ? 500 : 200).send({
      session: req.user,
      data: err ? err : vitamins.toJSON()
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
  var limit = parseInt(req.param('limit'), 10) || 50;

  if (limit < 0 || limit > 50) limit = 50;

  var query = req.param('q') ? unescape(req.param('q')) : null;
  var tags = req.param('tags') || [];

  tags = Array.isArray(tags) ? tags : [tags];

  var created_at = req.param('created_at') ? moment(req.param('created_at')) : null;

  var order_by = req.param('order_by') || 'desc';
  var validOrderBys = ['desc', 'asc', 'rand'];
  if (validOrderBys.indexOf(order_by) === -1) order_by = 'desc';

  var withRelated = ['artists','hosts'];

  if (req.user) {
    withRelated.push({
      'craters': function(qb) {
	qb.where('crates.user_id', req.user.id);
      }
    },{
      'tags': function(qb) {
	qb.where('tags.user_id', req.user.id);
      }
    });
  }

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

    qb.limit(limit).offset(offset);
    qb.groupBy('vitamins.id');

    if (order_by === 'rand')
      qb.orderByRaw('rand()');
    else
      qb.orderBy('crates.created_at', order_by);

    if (created_at) qb.where('crates.created_at', '>', created_at.format('YYYY-MM-DD HH:mm:ss'));
  }).fetch({
    withRelated: withRelated
  }).asCallback(function(err, vitamins) {
    if (err) log.error(err, res.locals.logRequest(req));
    res.status(err ? 500 : 200).send({
      session: req.user,
      data: err ? err : vitamins.toJSON()
    });
  });
};

var browse = function(req, res) {
  var offset = parseInt(req.param('offset'), 10) || 0;
  var limit = parseInt(req.param('limit'), 10) || 10;

  if (limit < 0 || limit > 20) limit = 20;

  var query = req.param('q') || null;
  var ids = req.param('ids') || [];

  async.waterfall([

    function(callback) {
      if (query) {
	res.locals.es.search({
	  index: 'vcy',
	  type: 'users',
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
      db.model('User')
	.collection()
	.query(function(qb) {
	  if (ids.length) {
	    qb.whereIn('id', ids);
	  } else {
	    qb.limit(limit)
	      .offset(offset)
	      .orderBy('created_at', 'desc');
	  }
	}).fetch({
	  withRelated: [
	    'prescriptionCount',
	    'crateCount'
	  ]
	}).asCallback(callback);
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
  res.locals.user.tags().fetch().asCallback(function(err, tags) {
    if (err) log.error(err, res.locals.logRequest(req));
    res.status(err ? 500 : 200).send({
      session: req.user,
      data: err ? err : tags.toJSON()
    });
  });
};

var tag = function(req, res) {
  var tags = req.param('tags') || [];
  var offset = parseInt(req.param('offset'), 10) || 0;
  var limit = parseInt(req.param('limit'), 10) || 20;

  if (limit < 0 || limit > 20) limit = 20;

  tags = Array.isArray(tags) ? tags : [tags];

  var withRelated = ['artists','hosts'];

  if (req.user) {
    withRelated.push({
      'craters': function(qb) {
	qb.where('crates.user_id', req.user.id);
      }
    },{
      'tags': function(qb) {
	qb.where('tags.user_id', req.user.id);
      }
    });
  }

  db.model('Vitamin').collection().query(function(qb) {
    qb.innerJoin('tags', 'vitamins.id', 'tags.vitamin_id')
      .where('tags.user_id', res.locals.user.id)
      .whereIn('tags.value', tags)
      .groupBy('vitamins.id')
      .limit(limit)
      .offset(offset)
      .havingRaw('COUNT(DISTINCT tags.value) = ?', tags.length);
  }).fetch({
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
  load: load,
  create: create,
  read: read,
  summary: summary,
  update: update,
  destroy: destroy,
  prescriptions: prescriptions,
  pages: pages,
  users: users,
  listens: listens,
  imports: imports,
  crate: crate,
  browse: browse,
  tags: tags,
  tag: tag,
  recommendations: recommendations,
  recommended: recommended
};
