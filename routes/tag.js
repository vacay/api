/* global require, module */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config);

var create = function(req, res) {
    var tag = req.param('value') || 'crate';

    db.model('Tag').create({
	user_id: req.user.id,
	vitamin_id: res.locals.vitamin.id,
	value: tag
    }).exec(function(err, data) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : data.toJSON()
	});
    });
};

var destroy = function(req, res) {
    var tag = req.param('value') || 'crate';

    db.knex('tags').where({
	user_id: req.user.id,
	vitamin_id: res.locals.vitamin.id,
	value: tag
    }).del().exec(function(err, data) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : data.toJSON()
	});
    });
};

module.exports = {
    create: create,
    destroy: destroy
};
