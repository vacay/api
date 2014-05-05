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
	    'subscriptions'
	]
    }).exec(function (err, user) {
	if (err) {
	    log.error(err);
	    res.send(500, {
		session: req.user,
		data: err
	    });
	} else {
	    db.model('User').edit({
		id: req.user.id,
		last_visit: new Date()
	    }).exec(function(err) {
		if (err) log.error(err);
	    });

	    var token = jwt.sign(req.user, config.session.secret, {expiresInMinutes: config.session.expires});
	    var data = user.toJSON();
	    data.email = user.attributes.email;
	    res.send(200, {
		session: req.user,
		data: data,
		token: token
	    });
	}
    });
};

var inbox = function(req, res) {

    var sort = req.param('sort') || 'desc';
    var offset = req.param('offset') || 0;
    
    db.model('User').forge({id: req.user.id}).inbox(sort, offset, function(err, prescriptions) {
	if (err) log.error(err);
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : prescriptions.toJSON()
	});
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
	type = req.param('type'),
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
    var offset = req.param('offset') || 0;
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
		    'vitamins.crates': function(qb) {
			qb.where('user_id', req.user.id);
		    }
		}
	    ]
	}).exec(function(err, prescriptions) {
	    if (err) log.error(err);
	    res.send(err ? 500 : 200, {
		session: req.user,
		data: err ? err : prescriptions.toJSON()
	    });
	});
};

module.exports = {
    index: index,
    inbox: inbox,
    upload: upload,
    drafts: drafts
};
