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
	    'groups'
	]
    }).exec(function (err, user) {
	if (err) {
	    log.error(err, res.locals.logRequest(req));
	    res.send(500, {
		session: req.user,
		data: err
	    });
	} else {
	    db.model('User').edit({
		id: req.user.id,
		last_visit: new Date()
	    }).exec(function(err) {
		if (err) log.error(err, res.locals.logRequest(req));
	    });

	    var token = jwt.sign(req.user, config.session.secret, {expiresInMinutes: config.session.expires});
	    var data = user.toJSON();

	    data.email = user.attributes.email;

	    data.subscriptions = data.users; //to be deprecated

	    res.send(200, {
		session: req.user,
		data: data,
		token: token
	    });
	}
    });
};

var inbox = function(req, res) {

    var response = function(err, prescriptions) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : prescriptions.toJSON()
	});
    };

    var sort = req.param('sort') || 'desc';
    var offset = parseInt(req.param('offset'), 10) || 0;

    var user = db.model('User').forge({id: req.user.id});

    user.subscriptions().exec(function(err, subscriptions) {
	if (err) {
	    response(err, null);
	    return;
	}

	var users = [0];
	var groups = [0];

	for(var i=0; i<subscriptions.length; i++) {
	    if (subscriptions[i].prescriber_type === 'users') {
		users.push(subscriptions[i].prescriber_id);
	    } else {
		groups.push(subscriptions[i].prescriber_id);
	    }
	}

	var query = function(qb) {

	    qb.leftJoin('prescriptions_users', 'prescriptions.id', 'prescriptions_users.prescription_id');
	    qb.leftJoin('prescriptions_groups', 'prescriptions.id', 'prescriptions_groups.prescription_id');

	    qb.where(function() {
		this.where(function() {
		    this.whereIn('prescriber_id', users).whereNull('prescriptions_users.user_id');
		}).orWhere(function() {
		    this.where('prescriptions_users.user_id', req.user.id);
		}).orWhere(function() {
		    this.whereIn('prescriptions_groups.group_id', groups);
		});
	    }).whereNotNull('published_at');

	    qb.limit(20);
	    qb.offset(offset);
	    qb.groupBy('prescriptions.id');
	    qb.orderBy('published_at', sort);
	};

	db.model('Prescription').collection().query(query).fetch({
	    withRelated: [
		'prescriber',
		'vitamins',
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
		'children',
		'children.prescriber',
		'parent',
		'parent.prescriber'
	    ]
	}).exec(response);
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
	    }, ['starts-with', '$key', '']
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
    
    res.send(200, {
	session: req.user,
	data: {
	    policy: p,
	    signature: s,
	    key: key
	}
    });
};

var drafts = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;
    db.model('Prescription')
	.collection()
	.query(function(qb) {
	    qb.whereNull('published_at').andWhere('prescriber_id', req.user.id).limit(20).offset(offset).orderBy('updated_at', 'desc');
	})
	.fetch({
	    withRelated: [
		'prescriber',
		'vitamins',
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
		'groups'
	    ]
	}).exec(function(err, prescriptions) {
	    if (err) log.error(err, res.locals.logRequest(req));
	    res.send(err ? 500 : 200, {
		session: req.user,
		data: err ? err : prescriptions.toJSON()
	    });
	});
};

var pages = function(req, res) {
    db.model('User').forge({id: req.user.id}).related('pages').fetch().exec(function(err, pages) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : pages.toJSON()
	});
    });
};

var tracker = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;
    db.model('Vitamin').collection().query(function(qb) {
	qb.innerJoin('pages_vitamins', 'vitamins.id', 'pages_vitamins.vitamin_id')
	    .innerJoin('pages_users', 'pages_vitamins.page_id', 'pages_users.page_id')
	    .where('pages_users.user_id', req.user.id)
	    .offset(offset)
	    .limit(50)
	    .groupBy('id')
	    .orderBy('pages_vitamins.created_at', 'desc');
    }).fetch({
	withRelated: [
	    'hosts',
	    'pages',
	    {
		tags: function(qb) {
		    qb.where('tags.user_id', req.user.id);
		}
	    },
	    {
		craters: function(qb) {
		    qb.where('crates.user_id', req.user.id);
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

var tags = function(req, res) {
    db.model('User').forge({id: req.user.id}).related('tags').fetch().exec(function(err, data) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : data.toJSON()
	});
    });
};


module.exports = {
    index: index,
    inbox: inbox,
    upload: upload,
    drafts: drafts,
    pages: pages,
    tracker: tracker,
    tags: tags
};
