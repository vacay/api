/* global require, module, unescape */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config);

var findOrCreate = function(req, res, next) {

    db.knex('crates').select().where({
	vitamin_id: res.locals.vitamin.id,
	user_id: req.user.id
    }).asCallback(function(err, crate) {

	if (err) {

	    log.error(err, res.locals.logRequest(req));
	    res.status(500).send({
		session: req.user,
		data: err
	    });

	} else if (!crate.length) {

	    db.model('User').forge({
		id: req.user.id
	    }).crate().attach({
		vitamin_id: res.locals.vitamin.id,
		created_at: new Date()
	    }).asCallback(function(err, data) {

		if (err) {
		    log.error(err, res.locals.logRequest(req));
		    res.status(500).send({
			session: req.user,
			data: err
		    });
		} else {
		    res.locals.crate = data;
		    next();
		}

	    });

	} else {
	    next();
	}
    });
};


var create = function(req, res) {
    db.model('User').forge({
	id: req.user.id
    }).crate().attach({
	vitamin_id: res.locals.vitamin.id,
	created_at: new Date()
    }).asCallback(function(err, data) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : data.toJSON()
	});
    });
};

var destroy = function(req, res) {
    db.model('User').forge({
	id: req.user.id
    }).crate().detach(res.locals.vitamin.id).asCallback(function(err, data) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : data.toJSON()
	});
    });
};

module.exports = {
    findOrCreate: findOrCreate,
    create: create,
    destroy: destroy
};
