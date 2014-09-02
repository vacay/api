/* global module, require */
var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config),
    jwt = require('jsonwebtoken');

module.exports.signin = function (req, res, next) {
    var email = req.param('email') || res.locals.email;
    var password = req.param('password') || res.locals.password;
    db.model('User').findOne({
	email: email
    }).then(function (user) {
	if (!user) {
	    res.send(400, {
		session: null,
		data: 'Invalid email'
	    });
	} else {
	    user.checkPassword(password, function (valid) {
		if (!valid) {
		    res.send(400, {
			session: null,
			data: 'Invalid password'
		    });
		} else {
		    req.user = {
			id : user.id,
			username: user.attributes.username
		    };
		    next();
		}
	    });
	}
    });
};

module.exports.signup = function (req, res, next) {
    db.model('User').create({
	email: req.param('email'),
	name: req.param('name'),
	password: req.param('password'),
	username: req.param('username')
    }, function (err, user) {
	if (err === 'Email exists' || err === 'Username exists') {
	    res.send(400, {
		session: null,
		data: err
	    });
	} else if (err) {
	    log.error(err, res.locals.logRequest(req));
	    res.send(500, {
		session: null,
		data: 'Could not add user'
	    });
	} else {
	    res.locals.email = user.email;
	    res.locals.password = user.password;
	    next();
	}
    });
};

module.exports.reset = function(req, res, next) {
    var resetToken = req.param('reset'),
	email = req.param('email');

    jwt.verify(resetToken, config.reset.secret, function(err, decoded) {
	if (err) log.error(err.toString());
	if (decoded.email !== email) {
	    res.send(400, {
		session: null,
		data: 'Invalid email'
	    });
	    return;
	}

	db.model('User').findOne({
	    email: email
	}).then(function (user) {
	    if (err) {
		log.error(err, res.locals.logRequest(req));
		res.send(400, {
		    session: null,
		    data: 'Please request a new reset password link'
		});
	    } else {
		user.resetPassword(req.param('password'), function(err) {
		    if (err) {
			log.error(err, res.locals.logRequest(req));
			res.send(500, {
			    session: null,
			    data: 'Unable to reset password'
			});
		    } else {
			req.user = {
			    id : user.id,
			    username: user.attributes.username
			};
			next();
		    }
		});
	    }
	});
    });
};

module.exports.requestReset = function(req, res) {
    db.model('User').findOne({
	email: req.param('email')
    }).then(function (user) {
	if (!user) {
	    res.send(400, {
		session: null,
		data: 'Invalid email'
	    });
	} else {

	    var token = jwt.sign({
		email: user.attributes.email
	    }, config.reset.secret, {
		expiresInMinutes: config.reset.expires
	    });
	    var emails = ['admin@vacay.io', user.attributes.email];
	    var html = '<p>Forget your password did you? Use the link below to set a new one</p>';
	    var link = {
		target: '/inbox?reset=' + token,
		text: 'reset password'
	    };

	    res.locals.queue.create('email', {
		title: 'reset:' + user.attributes.email,
		emails: emails,
		subject: 'vacay - password reset',
		html: html,
		link: link
	    }).removeOnComplete(true).save();

	    res.send(200, {
		session: null,
		data: 'sent'
	    });
	}
    });
};
