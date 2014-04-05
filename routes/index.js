/* global require, module, __dirname */

var auth = require('./auth'),
    path = require('path'),
    me = require('./me'),
    message = require('./message'),
    page = require('./page'),
    user = require('./user'),
    prescription = require('./prescription'),
    subscription = require('./subscription'),
    vitamin = require('./vitamin'),
    config = require('config-api'),
    log = require('log')(config.log),
    jwt = require('jsonwebtoken');

var authenticate = function(req, res, next) {
    var token = req.param('token');
    if (token) {
	jwt.verify(token, config.session.secret, function(err, decoded) {
	    if (err) log.error(err.toString());
	    req.user = decoded;
	    next();
	});
    } else {
	next();
    }
};

var isAuthenticated = function(req, res, next) {
    if (!req.user) {
	res.send(401, {
	    data: 'no session',
	    session: null
	});
    } else {
	next();
    }
};

var hasParams = function(params) {
    return function(req, res, next) {
	var missing, exists = true;
	exists = params.every(function(param) {
	    if (!req.param(param)) {
		missing = param;
		return false;
	    }
	    return true;
	});
	
	if (!exists) {
	    res.send(400, {
		message: 'missing param: ' + missing,
		session: req.user
	    });
	} else {
	    next();
	}
    };
};

module.exports = function (app) {

    app.all('/v1/*',
	    authenticate);

    app.post('/v1/auth/signup',
	     hasParams(['email', 'name', 'password', 'username']),
	     auth.signup,
	     auth.signin,
	     me.index);

    app.post('/v1/auth/signin',
	     hasParams(['email', 'password']),
	     auth.signin,
	     me.index);

    app.get('/v1/me',
	    isAuthenticated,
	    me.index);

    app.get('/v1/me/inbox',
	    isAuthenticated,
	    me.inbox);

    app.get('/v1/me/drafts',
	    isAuthenticated,
	    me.drafts);

    app.post('/v1/me/upload',
	    hasParams(['title']),
	    isAuthenticated,
	    me.upload);

    app.post('/v1/message',
	     hasParams(['name', 'email', 'subject', 'body']),
	     message.create);

    app.post('/v1/page',
	     hasParams(['url']),
	     page.create,
	     page.read);

    app.get('/v1/page/:page',
	    page.load,
	    page.read);

    app.get('/v1/prescriptions',
	    prescription.browse);

    //TODO: validate vitamins to make sure they exist
    //TODO: validate vitamin length
    app.post('/v1/prescription',
	     isAuthenticated,
	     prescription.create);

    app.get('/v1/prescription/:prescription',
	    prescription.load,
	    prescription.read);

    app.post('/v1/prescription/:prescription/publish',
	     isAuthenticated,
	     prescription.publish);

    //TODO: validate vitamins to make sure they exist
    //TODO: validate vitamin length
    app.put('/v1/prescription/:prescription',
	    isAuthenticated,
	    prescription.update);

    app.del('/v1/prescription/:prescription',
	    isAuthenticated,
	    prescription.destroy);

    app.get('/v1/users',
	    user.browse);

    app.get('/v1/user/:user',
	    user.load,
	    user.read);

    app.put('/v1/user/:user',
	    isAuthenticated,
	    hasParams(['name', 'bio', 'location']),
	    user.load,
	    user.update); 

    app.post('/v1/user/:user/subscription',
	     isAuthenticated,
	     hasParams(['prescriber_id']),
	     subscription.create);

    app.del('/v1/user/:user/subscription',
	    isAuthenticated,
	    hasParams(['prescriber_id']),
	    subscription.destroy);

    app.get('/v1/user/:user/subscribers',
	    user.load,
	    user.subscribers);

    app.get('/v1/user/:user/prescriptions',
	    user.load,
	    user.prescriptions);

    app.get('/v1/vitamins',
	    vitamin.browse);

    app.post('/v1/vitamin',
	     isAuthenticated,
	     hasParams(['url', 'title']),
	     vitamin.create);

    app.get('/v1/vitamin/:vitamin',
	    vitamin.load,
	    vitamin.read);

    app.put('/v1/vitamin/:vitamin',
	    isAuthenticated,
	    hasParams(['title']),
	    vitamin.load,
	    vitamin.update);

    app.get('/v1/vitamin/:vitamin/summary',
	    vitamin.load,
	    vitamin.summary);

    app.get('/v1/vitamin/:vitamin/prescriptions',
	    vitamin.load,
	    vitamin.prescriptions);

    app.get('/v1/vitamin/:vitamin/pages',
	    vitamin.load,
	    vitamin.pages);

    app.get('/health_check', function(req, res) {
	res.send(200);
    });

    app.get('*', function (req, res) {
	res.send(404, {
	    message: 'invalid endpoint: ' + req.url,
	    session: req.user
	});
    });

};
