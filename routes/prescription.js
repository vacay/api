/* global require, module, unescape */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config),
    utils = require('../lib/utils'),
    async = require('async');

var load = function(req, res, next) {
    db.model('Prescription').findOne({
	id: req.param('prescription')
    }).asCallback(function(err, prescription) {
	if (err || !prescription) {
	    if (err) log.error(err, res.locals.logRequest(req));
	    res.status(err ? 500 : 404).send({
		session: req.user,
		data: err ? err : 'invalid page id: ' + req.param('prescription')
	    });
	} else {
	    res.locals.prescription = prescription;
	    next();
	}
    });
};

var read = function(req, res) {
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

    res.locals.prescription.fetch({
	withRelated: withRelated
    }).asCallback(function(err, prescription) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user || null,
	  data: err ? err : (prescription ? prescription.toJSON() : null) //TODO : prescription should not be null
	});
    });
};

var create = function(req, res, next) {

    var params = {};

    if (typeof req.param('image') !== 'undefined') params.image_url = req.param('image');
    if (typeof req.param('description') !== 'undefined') params.description = req.param('description');
    if (typeof req.param('published_at') !== 'undefined') params.published_at = new Date();

    params.prescriber_id = req.user.id;

    async.waterfall([

	function(callback) {
	    if (params.description && params.description.length > 500) {
		callback('prescription description length of ' + params.description.length + ' is greater than limit of 500');
	    } else if (req.param('vitamins') && req.param('vitamins').length > 100) {
		callback('prescription vitamin length of ' + req.param('vitamins').length + ' is greater than limit of 100');
	    } else {
		callback();
	    }
	},

	function(callback) {
	    db.model('Prescription').create(params).asCallback(callback);
	},

	function(prescription, callback) {

	    if (!req.param('vitamins')) {
		callback(null, prescription);
		return;
	    }

	    var vitamins = req.param('vitamins');
	    vitamins.forEach(function(v) {
		v.prescription_id = prescription.id;
	    });

	    if (vitamins.length) {
		db.knex('prescriptions_vitamins').insert(vitamins).asCallback(function(err) {
		    callback(err, prescription);
		});
	    } else {
		callback(null, prescription);
	    }
	},

	function(prescription, callback) {

	    if (!req.param('users')) {
		callback(null, prescription);
		return;
	    }

	    var users = req.param('users');

	    if (users.length) {
		async.each(users, function(user, done) {
		    user.prescription_id = prescription.id;
		    if ((typeof user.user_id === 'string' || user.user_id instanceof String) && utils.isEmail(user.user_id)) {
			db.model('User').findOrCreate({
			    email: user.user_id
			}, function(err, result) {
			    if (err) done(err);
			    else {
				user.user_id = result.id;
				done();
			    }
			});
		    } else {
			done();
		    }
		}, function(err) {
		    db.knex('prescriptions_users').insert(users).asCallback(function(err) {
			callback(err, prescription);
		    });
		});
	    } else {
		callback(null, prescription);
	    }
	},

	function(prescription, callback) {

	    if (!req.param('groups')) {
		callback(null, prescription);
		return;
	    }

	    var groups = req.param('groups');
	    groups.forEach(function(g) {
		g.prescription_id = prescription.id;
	    });

	    if (groups.length) {
		db.knex('prescriptions_groups').insert(groups).asCallback(function(err) {
		    callback(err, prescription);
		});
	    } else {
		callback(null, prescription);
	    }
	}

    ], function(err, prescription) {

	if (err || !prescription) {
	    if (err) log.error(err, res.locals.logRequest(req));
	    res.status(err ? 500 : 404).send({
		session: req.user,
		data: err ? err : 'unable to create prescription'
	    });
	} else {
	    res.locals.prescription = prescription;
	    next();
	}
    });
};

var update = function(req, res) {

    var params = {};
    if (typeof req.param('image') !== 'undefined') params.image_url = req.param('image');
    if (typeof req.param('description') !== 'undefined') params.description = req.param('description');
    if (typeof req.param('published_at') !== 'undefined') params.published_at = new Date();

    params.id = req.param('prescription');

    async.waterfall([

	function(callback) {
	    if (params.description && params.description.length > 500) {
		callback('prescription description length: ' + params.description.length + ' greater than limit of 500');
	    } else if (req.param('vitamins') && req.param('vitamins').length > 100) {
		callback('prescription vitamin length: ' + req.param('vitamins').length + ' greater than limit of 100');
	    } else {
		callback();
	    }
	},

	function(callback) {
	    db.model('Prescription').edit(params).asCallback(callback);
	},
	
	function(prescription, callback) {

	    if (!req.param('vitamins')) {
		callback(null, prescription);
		return;
	    }

	    db.knex('prescriptions_vitamins')
		.where('prescription_id', prescription.id)
		.del()
		.asCallback(function(err) {
		    callback(err, prescription);
		});
	},

	function(prescription, callback) {

	    if (!req.param('vitamins')) {
		callback(null, prescription);
		return;
	    }

	    var vitamins = req.param('vitamins');

	    if (vitamins.length) {

		for (var i=0; i<vitamins.length; i++) {
		    vitamins[i].prescription_id = prescription.id;
		}

		db.knex('prescriptions_vitamins').insert(vitamins).asCallback(function(err) {
		    callback(err, prescription);
		});

	    } else {
		callback(null, prescription);
	    }

	},

	function(prescription, callback) {

	    if (!req.param('users') || prescription.published_at) {
		callback(null, prescription);
		return;
	    }

	    db.knex('prescriptions_users').where({
		prescription_id: prescription.id
	    }).del().asCallback(function(err) {
		callback(err, prescription);
	    });
	},

	function(prescription, callback) {

	    if (!req.param('users') || prescription.published_at) {
		callback(null, prescription);
		return;
	    }

	    var users = req.param('users');

	    if (users.length) {
		async.each(users, function(user, done) {
		    user.prescription_id = prescription.id;
		    if ((typeof user.user_id === 'string' || user.user_id instanceof String) && utils.isEmail(user.user_id)) {
			console.log(user);
			db.model('User').findOrCreate({
			    email: user.user_id
			}, function(err, result) {
			    if (err) done(err);
			    else {
				user.user_id = result.id;
				done();
			    }
			});
		    } else {
			done();
		    }

		}, function(err) {
		    if (err) log.error(err, res.locals.logRequest(req));
		    db.knex('prescriptions_users').insert(users).asCallback(function(err) {
			callback(err, prescription);
		    });
		});
	    } else {
		callback(null, prescription);
	    }
	},

	function(prescription, callback) {

	    if (!req.param('groups') || prescription.published_at) {
		callback(null, prescription);
		return;
	    }

	    db.knex('prescriptions_groups').where({
		prescription_id: prescription.id
	    }).del().asCallback(function(err) {
		callback(err, prescription);
	    });
	},

	function(prescription, callback) {

	    if (!req.param('groups') || prescription.published_at) {
		callback(null, prescription);
		return;
	    }

	    var groups = req.param('groups');

	    if (groups.length) {

		for (var i=0; i<groups.length; i++) {
		    groups[i].prescription_id = prescription.id;
		}

		db.knex('prescriptions_groups').insert(groups).asCallback(function(err) {
		    callback(err, prescription);
		});

	    } else {
		callback(null, prescription);
	    }

	}

    ], function(err, prescription) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : prescription.toJSON()
	});
    });
};

var destroy = function(req, res) {
    res.locals.prescription.destroy().asCallback(function(err, result) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : result.toJSON()
	});
    });
};

var browse = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;
    var query = req.param('q') ? unescape(req.param('q')) : null;
    var ids = req.param('ids') || [];
    var limit = parseInt(req.param('limit'), 10) || 10;

    if (limit < 0 || limit > 20) limit = 20;

    var orderBy = req.param('orderby') || null;
    var featured = req.param('featured') === 'true' ? true : false;
    var subscriptions = req.param('subscriptions') === 'true' ? true : false;

    if (subscriptions && !req.user) {
	res.status(401).send({
	    session: req.user,
	    data: 'no session'
	});
	return;
    }

    var users = [0];

    async.waterfall([

	function(cb) {
	    if (!subscriptions) {
		cb(null, null);
		return;
	    }

	    db.knex('subscriptions').where({
		subscriber_id: req.user.id,
		prescriber_type: 'users'
	    }).asCallback(cb);
	},

	function(result, cb) {
	    if (result) {
		for (var i=0; i<result.length; i++) {
		    users.push(result[i].prescriber_id);
		}
	    }
	    cb();
	},

	function(callback) {
	    if (query) {
		res.locals.es.search({
		    index: 'vcy',
		    type: 'prescriptions',
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

	    db.model('Prescription')
		.collection()
		.query(function(qb) {
		    if (ids.length) {
			qb.whereIn('id', ids);
		    } else {
			qb.leftOuterJoin('prescriptions_users', 'prescriptions.id', 'prescriptions_users.prescription_id')
			    .whereNull('prescriptions_users.user_id')
			    .whereNotNull('prescriptions.published_at')
			    .limit(limit)
			    .offset(offset);

			if (featured) {
			    qb.where('prescriptions.featured', true);
			    qb.orWhere('prescriptions.prescriber_id', 1);
			}

			if (subscriptions) {
			    qb.leftJoin('votes', 'prescriptions.id', 'votes.voteable_id');
			    qb.where(function() {
				this.where(function() {
				    this.whereIn('prescriber_id', users);
				}).orWhere(function() {
				    this.whereIn('votes.user_id', users).where('votes.voteable_type', 'prescriptions');
				});

				//TODO - prescriptions sent directly to a user
			    });

			    qb.where('prescriptions.prescriber_id', '!=', req.user.id);

			    qb.groupBy('prescriptions.id');
			}

			switch (orderBy) {

			case 'random':
			    qb.orderByRaw('RAND()');
			    break;

			default:
			    qb.orderBy('published_at', 'desc');
			    break;
			}
		    }
		}).fetch({
		    withRelated: withRelated
		}).asCallback(callback);
	}

    ], function(err, prescriptions) {

	var data = [];

	if (err) log.error(err, res.locals.logRequest(req));
	else {
	    data = !prescriptions ? [] : prescriptions.toJSON();

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

var vote = function(req, res) {
    db.model('Vote').forge({
	vote: 1,
	user_id: req.user.id,
	voteable_id: res.locals.prescription.id,
	voteable_type: 'prescriptions'
    }).save().asCallback(function(err, vote) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : vote.toJSON()
	});
    });
};

var destroyVote = function(req, res) {
    db.model('Vote').forge().query('where', {
	user_id: req.user.id,
	voteable_id: res.locals.prescription.id,
	voteable_type: 'prescriptions'
    }).destroy().asCallback(function(err, vote) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : vote.toJSON()
	});
    });
};

var addVitamin = function(req, res, next) {
    var prescription_id = req.param('prescription');
    var vitamin_id = parseInt(req.param('vitamin_id'), 10);

    async.waterfall([
	function(cb) {
	    db.knex('prescriptions_vitamins').select().where({
		prescription_id: prescription_id
	    }).asCallback(cb);
	},
	function(vitamins, cb) {
	    db.knex('prescriptions_vitamins').insert({
		vitamin_id: vitamin_id,
		prescription_id: prescription_id,
		order: vitamins.length
	    }).asCallback(cb);
	}
    ], function(err, result) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500: 200).send({
	    session: req.user,
	    data: err ? err : result
	});
    });
};

var destroyVitamin = function(req, res) {
    var prescription_id = req.param('prescription');
    var vitamin_id = parseInt(req.param('vitamin_id'), 10);

    var newVitamins = [];

    async.waterfall([
	function(cb) {
	    db.knex('prescriptions_vitamins').select().where({
		prescription_id: prescription_id
	    }).orderBy('order', 'asc').asCallback(cb);
	},
	function(vitamins, cb) {
	    vitamins.forEach(function(v) {
		if (v.vitamin_id !== vitamin_id) {
		    newVitamins.push({
			prescription_id: prescription_id,
			vitamin_id: v.vitamin_id,
			order: newVitamins.length
		    });
		}
	    });

	    db.knex('prescriptions_vitamins').del().where({
		prescription_id: prescription_id
	    }).asCallback(cb);
	},
	function(result, cb) {
	    if (!newVitamins.length) {
		cb();
		return;
	    }

	    db.knex('prescriptions_vitamins').insert(newVitamins).asCallback(cb);
	}
    ], function(err, result) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500: 200).send({
	    session: req.user,
	    data: err ? err : result
	});
    });
};

module.exports = {
    load: load,
    read: read,
    create: create,
    update: update,
    destroy: destroy,
    browse: browse,
    addVitamin: addVitamin,
    destroyVitamin: destroyVitamin,
    vote: vote,
    destroyVote: destroyVote
};
