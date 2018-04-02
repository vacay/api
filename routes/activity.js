/* global module, require */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config);

var index = function(req, res) {
  var offset = parseInt(req.param('offset'), 10) || 0;
  var limit = parseInt(req.param('limit'), 10) || 50;

  var tag = '@' + req.user.username;

  if (limit < 0 || limit > 50) limit = 50;

  var withRelated = [
    'artists',
    'hosts',
    'pages',
    {
      tags: function(qb) {
	qb.where('tags.user_id', req.user.id);
      }
    }, {
      craters: function(qb) {
	qb.where('crates.user_id', req.user.id);
      }
    }, {
      taggers: function(qb) {
	qb.where('tags.value', tag);
      }
    }
  ];

  var query = function(qb) {
    qb.select(db.knex.raw('vitamins.*, tags.created_at as published_at, tags.user_id as user_id'));
    qb.innerJoin('tags', 'vitamins.id', 'tags.vitamin_id');
    qb.where('tags.value', tag);
    qb.limit(limit);
    qb.offset(offset);
    qb.orderByRaw('tags.created_at DESC');
  };

  db.model('Vitamin').collection().query(query).fetch({
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
  index: index
};
