/* global require, module */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config);

var browse = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;
    var query = req.param('q') || null;
    var tags = req.param('tags') || [];

    tags = Array.isArray(tags) ? tags : [tags];

    db.model('User').forge({
	id: req.user.id
    }).related('crate').query(function(qb) {
	if (tags.length) {
	    qb.innerJoin('tags', 'vitamins.id', 'tags.vitamin_id')
		.where('tags.user_id', req.user.id)
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
	qb.limit(50).offset(offset).groupBy('vitamins.id').orderBy('crates.created_at', 'desc');
    }).fetch({
	withRelated: [
	    'hosts',
	    {
		'craters': function(qb) {
		    qb.where('crates.user_id', req.user.id);
		}
	    },
	    {
		'tags': function(qb) {
		    qb.where('tags.user_id', req.user.id);
		}
	    }
	]
    }).exec(function(err, vitamins) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : vitamins.toJSON()
	});
    });
};

var findOrCreate = function(req, res, next) {

    db.knex('crates').select().where({
	vitamin_id: res.locals.vitamin.id,
	user_id: req.user.id
    }).exec(function(err, crate) {

	if (err) {

	    log.error(err, res.locals.logRequest(req));
	    res.send(500, {
		session: req.user,
		data: err
	    });

	} else if (!crate.length) {

	    db.model('User').forge({
		id: req.user.id
	    }).crate().attach({
		vitamin_id: res.locals.vitamin.id,
		created_at: new Date()
	    }).exec(function(err, data) {

		if (err) {
		    log.error(err, res.locals.logRequest(req));
		    res.send(500, {
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
    }).exec(function(err, data) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : data.toJSON()
	});
    });
};

var destroy = function(req, res) {
    db.model('User').forge({
	id: req.user.id
    }).crate().detach(res.locals.vitamin.id).exec(function(err, data) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : data.toJSON()
	});
    });
};

module.exports = {
    browse: browse,
    findOrCreate: findOrCreate,
    create: create,
    destroy: destroy
};
