/* global require, module */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config);

var create = function(req, res) {
    var tag = req.param('value');

    if (!/^[@A-Za-z0-9\-_.+!*'&][A-Za-z0-9\s\-_.+!*'&\/]*$/.test(tag)) {
	res.status(403).send({
	    session: req.user,
	    data: 'tag value contains invalid characters'
	});
	return;
    }

    db.model('Tag').create({
	user_id: req.user.id,
	vitamin_id: res.locals.vitamin.id,
	value: tag
    }).asCallback(function(err, data) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : data.toJSON()
	});
    });
};

var destroy = function(req, res) {
    var tag = req.param('value');

    db.knex('tags').where({
	user_id: req.user.id,
	vitamin_id: res.locals.vitamin.id,
	value: tag
    }).del().asCallback(function(err, numRows) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : numRows
	});
    });
};

module.exports = {
    create: create,
    destroy: destroy
};
