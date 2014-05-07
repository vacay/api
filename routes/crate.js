/* global require, module */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config);

var browse = function(req, res) {
    var offset = req.param('offset') || 0;
    db.model('User').forge({
	id: req.user.id
    }).related('crate').query(function(qb) {
	qb.limit(50).offset(offset);
    }).fetch({
	withRelated: [
	    'hosts',
	    {
		'crates': function(qb) {
		    qb.where('user_id', req.user.id);
		}
	    }
	]
    }).exec(function(err, vitamins) {
	if (err) log.error(err);
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err || !vitamins ? [] : vitamins.toJSON()
	});
    });
};

var create = function(req, res) {
    db.model('User').forge({
	id: req.user.id
    }).crate().attach(res.locals.vitamin.id).exec(function(err, data) {
	if (err) log.error(err);
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err || !data ? [] : data.toJSON()
	});
    });
};

var destroy = function(req, res) {
    db.model('User').forge({
	id: req.user.id
    }).crate().detach(req.param('vitamin')).exec(function(err, data) {
	if (err) log.error(err);
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err || !data ? [] : data.toJSON()
	});
    });
};

module.exports = {
    browse: browse,
    create: create,
    destroy: destroy
};
