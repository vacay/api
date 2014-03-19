/* global module, require */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config);

var load = function(req, res, next) {
    db.model('User').findOne({
	username: req.param('user')
    }).exec(function(err, user) {
	if (err) {
	    log.error(err);
	    res.send(500, {
		session: req.user,
		data: err
	    });
	} else if (!user) {
	    res.send(404, {
		session: req.user,
		data: 'invalid username: ' + req.param('user')
	    });
	} else {
	    res.locals.user = user;
	    next();
	}
    });
};

var read = function(req, res) {
    res.locals.user.fetch({
	withRelated: [
	    {
		'prescriptions': function(qb) {
		    qb.whereNull('recipient_id').limit(20).orderBy('prescriptions.created_at', 'desc');
		}
	    },
	    'prescriptions.prescriber',
	    'prescriptions.vitamins',
	    'prescriptions.vitamins.hosts'
	]
    }).exec(function(err, user) {
	if (err) log.error(err);
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : user.toJSON()
	});
    });
};

var update = function(req, res) {
    db.model('User').edit({
	id: res.locals.user.id,
	name: req.param('name'),
	bio: req.param('bio'),
	location: req.param('location'),
	avatar: req.param('avatar')
    }).exec(function(err, user) {
	if (err) log.error(err);
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : user.toJSON()
	});
    });
};

var subscribers = function(req, res) {
    var offset = req.param('offset') || 0;
    res.locals.user.fetch({
	withRelated: [
	    {
		'subscribers': function(qb) {
		    //TODO: orderby probably isnt working
		    qb.orderBy('created_at', 'desc').limit(20).offset(offset);
		}
	    }
	]
    }).exec(function(err, user) {
	if (err) log.error(err);
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : user.toJSON()
	});
    });
};

var prescriptions = function(req, res) {
    var offset = req.param('offset') || 0;
    res.locals.user.prescriptions().query(function(qb) {
	qb.whereNull('prescriptions.recipient_id')
	    .orderBy('prescriptions.created_at', 'desc')
	    .limit(20)
	    .offset(offset);
    }).fetch({
	withRelated: [
	    'prescriber',
	    'vitamins',
	    'vitamins.hosts'
	]
    }).exec(function(err, user) {
	if (err) log.error(err);
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : user.toJSON()
	});
    });
};

module.exports = {
    load: load,
    read: read,
    update: update,
    subscribers: subscribers,
    prescriptions: prescriptions
};
