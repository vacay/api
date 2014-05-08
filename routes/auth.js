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
	    log.error(err);
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
		log.error(err);
		res.send(400, {
		    session: null,
		    data: 'Please request a new reset password link'
		});
	    } else {
		user.resetPassword(req.param('password'), function(err) {
		    if (err) {
			log.error(err);
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
	    var resetLink = config.url + '/inbox?reset=' + token;
	    var mailOptions = {
		from: 'Vacay <admin@vacay.io>',
		to: user.attributes.name + ' <' + user.attributes.email + '>',
		subject: 'vacay.io: password reset link',
		html: 'Reset password: <a href="' + resetLink + '">' + resetLink + '</a>' 
	    };
	    res.locals.smtp.sendMail(mailOptions, function(err, data) {
		if (err) log.error(err);
		res.send(err ? 500 : 200, {
		    session: null,
		    data: err ? 'Failed to send link, try again later' : 'sent'
		});
	    });
	}
    });
};
