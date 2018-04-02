/* global module, require, Buffer */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config),
    crypto = require('crypto'),
    uuid = require('uuid'),
    moment = require('moment'),
    jwt = require('jsonwebtoken');

var index = function (req, res) {
  db.model('User').forge({id:req.user.id}).fetch({
    withRelated: [
      'users',
      'groups',
      'pages',
      'tags'
    ]
  }).asCallback(function (err, user) {
    if (err || !user) {
      if (err) log.error(err, res.locals.logRequest(req));
      res.status(500).send({
	session: req.user,
	data: err || 'invalid id'
      });
    } else {
      var opts = {};
      if (req.user && !req.user.exp)
	opts.expiresIn = config.session.expires
      var token = jwt.sign(req.user, config.session.secret, opts);
      var data = user.toJSON();

      data.email = user.attributes.email;

      res.status(200).send({
	session: req.user,
	data: data,
	token: token,
	client_ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
      });

      db.model('User').edit({
	id: req.user.id,
	last_visit: new Date()
      }).asCallback(function(err) {
	if (err) log.error(err, res.locals.logRequest(req));
      });
    }
  });
};

var signature = function(policy) {
  return crypto.createHmac('sha1', config.s3.secret).update(policy).digest('base64');
};

var policy = function() {
  var s3Policy = {
    expiration: moment.utc().add('minutes', 2).format('YYYY-MM-DDTHH:mm:ss\\Z'),
    conditions: [
      {
	bucket: config.s3.bucket
      }, {
	acl: 'public-read'
      }, {
	success_action_status: '201'
      }, ['starts-with', '$key', config.s3.folder + '/tmp']
    ]
  };
  return new Buffer(JSON.stringify(s3Policy)).toString('base64');
};

var upload = function(req, res) {
  var p = policy(),
      s = signature(p),
      ext = req.param('ext'),
      filename = req.user.id + '_' + uuid.v4() + '.' + ext,
      key = config.s3.folder + '/tmp/' + filename;

  res.status(200).send({
    session: req.user,
    data: {
      policy: p,
      signature: s,
      key: key
    }
  });
};

var drafts = function(req, res) {
  if (req.param('user') !== req.user.username) {
    res.status(401).send({
      session: req.user,
      data: 'unauthorized'
    });
    return;
  }

  var offset = parseInt(req.param('offset'), 10) || 0;
  var limit = parseInt(req.param('limit'), 10) || 20;

  if (limit < 0 || limit > 20) limit = 20;

  db.model('Prescription')
    .collection()
    .query(function(qb) {
      qb.whereNull('published_at').andWhere('prescriber_id', req.user.id).limit(limit).offset(offset).orderBy('updated_at', 'desc');
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
	'votes',
	'votes.user'
      ]
    }).asCallback(function(err, prescriptions) {
      if (err) log.error(err, res.locals.logRequest(req));
      res.status(err ? 500 : 200).send({
	session: req.user,
	data: err ? err : prescriptions.toJSON()
      });
    });
};

var watching = function(req, res) {
  if (req.param('user') !== req.user.username) {
    res.status(401).send({
      session: req.user,
      data: 'unauthorized'
    });
    return;
  }

  db.model('User').forge({id: req.user.id}).watching().fetch({
    withRelated: [
      'user',
      'watchers',
      'votes'
    ]
  }).asCallback(function(err, discussions) {
    if (err) log.error(err, res.locals.logRequesst(req));
    res.status(err ? 500 : 200).send({
      session: req.user,
      data: err ? err : discussions.toJSON()
    });
  });
};

var sync = function(req, res) {
  var ids = req.param('ids') || [];
  ids = Array.isArray(ids) ? ids : [ids];

  var query = db.knex.select('vitamins.*').from('vitamins')
	.leftJoin('crates', 'vitamins.id', 'crates.vitamin_id')
	.whereIn('vitamins.id', ids).whereNull('crates.vitamin_id');

  query.asCallback(function(err, vitamins) {
    if (err) log.error(err, res.locals.logRequest(req));
    res.status(err ? 500 : 200).send({
      session: req.user,
      data: err ? err : vitamins
    });
  });
};


module.exports = {
  index: index,
  upload: upload,
  drafts: drafts,
  watching: watching,
  sync: sync
};
