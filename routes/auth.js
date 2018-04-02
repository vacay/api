/* global module, require */
var config	= require('config-api')
var log		= require('log')(config.log)
var db		= require('db')(config)
var jwt		= require('jsonwebtoken')

module.exports.signin = function (req, res, next) {
  var email = req.param('email') || res.locals.email;
  var password = req.param('password') || res.locals.password;
  db.model('User').findOne({
    email: email
  }).then(function (user) {
    if (!user) {
      res.status(400).send({
	session: null,
	data: 'Invalid email'
      });
    } else {
      user.checkPassword(password, function (valid) {
	if (!valid) {
	  res.status(400).send({
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

  var password = req.param('password');
  if (!password) {
    res.status(400).send({
      session: null,
      data: 'Missing password'
    });
    return;
  }

  var invite = req.param('invite');

  if (invite) {
    jwt.verify(invite, config.invite.secret, function(err, decoded) {
      if (err) {
	res.status(400).send({
	  session: null,
	  data: 'Invalid invite token'
	});
	return;
      }

      var username = req.param('username');

      db.model('User').findOne({
	username: username
      }).asCallback(function(err, user) {
	if (err) {
	  log.error(err, res.locals.logRequest(req));
	  res.status(500).send({
	    session: null,
	    data: 'Invalid request'
	  });
	  return;
	}

	if (user) {
	  res.status(400).send({
	    session: null,
	    data: 'Username taken'
	  });
	  return;
	}

	db.model('User').findOne({
	  email: req.param('email')
	}).asCallback(function (err, user) {
	  if (err) {
	    log.error(err, res.locals.logRequest(req));
	    res.status(500).send({
	      session: null,
	      data: 'Invalid request'
	    });
	    return;
	  }

	  if (!user) {
	    res.status(400).send({
	      session: null,
	      data: 'Problem retrieving invite'
	    });
	    return;
	  }

	  user.acceptInvite({
	    name: req.param('name'),
	    password: password,
	    username: req.param('username')
	  }, function(err, user) {
	    if (err) {
	      log.error(err, res.locals.logRequest(req));
	      res.status(500).send({
		session: null,
		data: 'Problem accepting invite'
	      });
	      return;
	    }

	    res.locals.email = user.email;
	    res.locals.password = user.password;
	    next();
	  });
	});
      });
    });
  } else {

    db.model('User').create({
      email: req.param('email'),
      name: req.param('name'),
      password: password,
      username: req.param('username')
    }, function (err, user) {
      if (err === 'Email exists' || err === 'Username exists') {
	res.status(400).send({
	  session: null,
	  data: err
	});
      } else if (err) {
	log.error(err, res.locals.logRequest(req));
	res.status(500).send({
	  session: null,
	  data: 'Could not add user'
	});
      } else {
	res.locals.email = user.email;
	res.locals.password = user.password;
	next();
      }
    });

  }
};

module.exports.reset = function(req, res, next) {
  var resetToken = req.param('reset'),
      email = req.param('email');

  jwt.verify(resetToken, config.reset.secret, function(err, decoded) {
    if (err) log.error(err.toString());
    if (decoded.email !== email) {
      res.status(400).send({
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
	res.status(400).send({
	  session: null,
	  data: 'Please request a new reset password link'
	});
      } else {
	var password = req.param('password');

	if (!password) {
	  res.status(400).send({
	    session: null,
	    data: 'Missing password'
	  });
	  return;
	}

	user.resetPassword(password, function(err) {
	  if (err) {
	    log.error(err, res.locals.logRequest(req));
	    res.status(500).send({
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
      res.status(400).send({
	session: null,
	data: 'Invalid email'
      });
    } else {

      var token = jwt.sign({
	email: user.attributes.email
      }, config.reset.secret, {
	expiresIn: config.reset.expires
      });
      var emails = [user.attributes.email];
      var body = 'Forget your password did you? Use the link below to set a new one';
      var link = {
	target: '/inbox?reset=' + token,
	text: 'reset password'
      };

      res.locals.sendEmail({
	title: 'reset:' + user.attributes.email,
	emails: emails,
	subject: 'vacay - password reset',
	body: body,
	link: link
      }, function(err) {
	if (err) log.error(err)
      })

      res.status(200).send({
	session: null,
	data: 'sent'
      });
    }
  });
};
