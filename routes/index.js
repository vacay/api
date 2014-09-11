/* global require, module, __dirname */

var auth = require('./auth'),
    path = require('path'),
    me = require('./me'),
    message = require('./message'),
    page = require('./page'),
    user = require('./user'),
    prescription = require('./prescription'),
    discussion = require('./discussion'),
    subscription = require('./subscription'),
    vitamin = require('./vitamin'),
    tag = require('./tag'),
    group = require('./group'),
    crate = require('./crate'),
    image = require('./image'),
    config = require('config-api'),
    log = require('log')(config.log),
    jwt = require('jsonwebtoken');

var authenticate = function(req, res, next) {
    var token = req.param('token');
    if (token && token !== 'undefined') {
	jwt.verify(token, config.session.secret, function(err, decoded) {
	    if (err) log.error(err.toString(), res.locals.logRequest(req));
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

    app.get('/v1/auth/reset',
	    hasParams(['email']),
	    auth.requestReset);

    app.post('/v1/auth/reset',
	     hasParams(['reset', 'email', 'password']),
	     auth.reset,
	     me.index);

    app.post('/v1/auth/signup',
	     hasParams(['email', 'name', 'password', 'username']),
	     auth.signup,
	     auth.signin,
	     me.index);

    app.post('/v1/auth/signin',
	     hasParams(['email', 'password']),
	     auth.signin,
	     me.index);

    app.get('/v1/discussions',
	    isAuthenticated,
	    discussion.browse);

    app.post('/v1/discussion',
	     isAuthenticated,
	     hasParams(['title', 'description']),
	     discussion.create);

    app.get('/v1/discussion/:discussion',
	    isAuthenticated,
	    discussion.load,
	    discussion.read);

    app.put('/v1/discussion/:discussion',
	    isAuthenticated,
	    hasParams(['title', 'description']),
	    discussion.load,
	    discussion.update);

    app.post('/v1/discussion/:discussion/vote',
	     isAuthenticated,
	     hasParams(['vote']),
	     discussion.load,
	     discussion.createDiscussionVote);

    app.del('/v1/discussion/:discussion/vote',
	    isAuthenticated,
	    discussion.load,
	    discussion.destroyDiscussionVote);

    app.post('/v1/discussion/:discussion/comment',
	     isAuthenticated,
	     hasParams(['body']),
	     discussion.load,
	     discussion.createComment);

    app.put('/v1/discussion/:discussion/comment/:comment',
	    isAuthenticated,
	    hasParams(['body']),
	    discussion.loadComment,
	    discussion.updateComment);

    app.post('/v1/discussion/:discussion/comment/:comment/vote',
	     isAuthenticated,
	     hasParams(['vote']),
	     discussion.loadComment,
	     discussion.createCommentVote);

    app.del('/v1/discussion/:discussion/comment/:comment/vote',
	    isAuthenticated,
	    discussion.loadComment,
	    discussion.destroyCommentVote);

    app.post('/v1/group',
	     isAuthenticated,
	     hasParams(['name', 'description']),
	     group.create);

    app.get('/v1/group/:group',
	    isAuthenticated,
	    group.load,
	    group.read);

    app.post('/v1/group/:group/subscription',
	     isAuthenticated,
	     group.load,
	     subscription.create);

    app.del('/v1/group/:group/subscription',
	    isAuthenticated,
	    group.load,
	    subscription.destroy);

    app.get('/v1/groups',
	    isAuthenticated,
	    group.browse);

    app.get('/v1/image',
	    isAuthenticated,
	    hasParams(['url']),
	    image.proxy);

    app.get('/v1/me',
	    isAuthenticated,
	    me.index);

    app.get('/v1/me/crate',
	    isAuthenticated,
	    crate.browse);

    app.get('/v1/me/tags',
	    isAuthenticated,
	    me.tags);

    app.get('/v1/me/inbox',
	    isAuthenticated,
	    me.inbox);

    app.get('/v1/me/drafts',
	    isAuthenticated,
	    me.drafts);

    app.get('/v1/me/pages',
	    isAuthenticated,
	    me.pages);

    app.get('/v1/me/tracker',
	    isAuthenticated,
	    me.tracker);

    app.post('/v1/me/upload',
	     isAuthenticated,
	     hasParams(['ext']),
	     me.upload);

    app.post('/v1/message',
	     hasParams(['name', 'email', 'subject', 'body']),
	     message.create);

    //backward compatible for chrome ext
    app.post('/v1/page',
	     isAuthenticated,
	     hasParams(['url']),
	     page.create,
	     page.read);

    app.get('/v1/page/:page',
	    isAuthenticated,
	    page.load,
	    page.read);

    app.post('/v1/page/:page/track',
	     isAuthenticated,
	     page.load,
	     page.track);

    app.del('/v1/page/:page/track',
	    isAuthenticated,
	    page.load,
	    page.untrack);

    app.get('/v1/prescriptions',
	    isAuthenticated,
	    prescription.browse);

    //TODO: validate vitamins to make sure they exist
    app.post('/v1/prescription',
	     isAuthenticated,
	     prescription.create);

    app.get('/v1/prescription/:prescription',
	    prescription.load,
	    prescription.read);

    //TODO: validate vitamins to make sure they exist
    app.put('/v1/prescription/:prescription',
	    isAuthenticated,
	    prescription.update);

    app.del('/v1/prescription/:prescription',
	    isAuthenticated,
	    prescription.destroy);

    app.get('/v1/users',
	    isAuthenticated,
	    user.browse);

    app.get('/v1/user/:user',
	    isAuthenticated,
	    user.load,
	    user.read);

    app.put('/v1/user/:user',
	    isAuthenticated,
	    user.load,
	    user.update); 

    app.post('/v1/user/:user/subscription',
	     isAuthenticated,
	     user.load,
	     subscription.create);

    app.del('/v1/user/:user/subscription',
	    isAuthenticated,
	    user.load,
	    subscription.destroy);

    app.get('/v1/user/:user/subscribers',
	    isAuthenticated,
	    user.load,
	    user.subscribers);

    app.get('/v1/user/:user/prescriptions',
	    isAuthenticated,
	    user.load,
	    user.prescriptions);

    app.get('/v1/vitamins',
	    isAuthenticated,
	    vitamin.browse);

    app.get('/v1/vitamins/sync',
	    isAuthenticated,
	    hasParams(['ids']),
	    vitamin.sync);

    app.post('/v1/vitamin',
	     isAuthenticated,
	     hasParams(['url', 'title', 'host', 'stream_url']),
	     vitamin.create);

    app.get('/v1/vitamin/:vitamin',
	    isAuthenticated,
	    vitamin.load,
	    vitamin.read);

    app.post('/v1/vitamin/:vitamin/crate',
	     isAuthenticated,
	     vitamin.load,
	     crate.create);

    app.post('/v1/vitamin/:vitamin/tag',
	     isAuthenticated,
	     vitamin.load,
	     crate.findOrCreate,
	     tag.create);

    app.del('/v1/vitamin/:vitamin/crate',
	    isAuthenticated,
	    vitamin.load,
	    crate.destroy);

    app.del('/v1/vitamin/:vitamin/tag',
	    isAuthenticated,
	    vitamin.load,
	    tag.destroy);

    app.put('/v1/vitamin/:vitamin',
	    isAuthenticated,
	    hasParams(['title']),
	    vitamin.load,
	    vitamin.update);

    app.post('/v1/logger', isAuthenticated, hasParams(['error']), function(req, res) {
	var error = req.param('error');
	error.user = req.user;
	log.error(error.errorMessage, error);
	res.send(200);
    });

    app.get('*', function (req, res) {
	res.send(404, {
	    message: 'invalid endpoint: ' + req.url,
	    session: req.user
	});
    });

};
