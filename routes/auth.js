/* global module, require */
var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config);

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
