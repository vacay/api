/* global require, module */

var artist = require('./artist'),
    auth = require('./auth'),
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
	res.status(401).send({
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
	    res.status(400).send({
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

    app.get('/v1/artists',
	    isAuthenticated,
	    artist.browse);

    app.get('/v1/artist/:artist',
	    isAuthenticated,
	    artist.load,
	    artist.read);

    app.get('/v1/artist/:artist/vitamins',
	    isAuthenticated,
	    artist.load,
	    artist.vitamins);

    app.get('/v1/artist/:artist/originals',
	    isAuthenticated,
	    artist.load,
	    artist.originals);

    app.get('/v1/artist/:artist/variations',
	    isAuthenticated,
	    artist.load,
	    artist.variations);

    app.post('/v1/artist/:artist/subscribe',
	    isAuthenticated,
	    artist.load,
	    artist.subscribe);

    app.delete('/v1/artist/:artist/subscribe',
	   isAuthenticated,
	   artist.load,
	   artist.unsubscribe);

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

    app.post('/v1/discussion/:discussion/watch',
	     isAuthenticated,
	     discussion.load,
	     discussion.watch);

    app.delete('/v1/discussion/:discussion/watch',
	       isAuthenticated,
	       discussion.load,
	       discussion.unwatch);

    app.post('/v1/discussion/:discussion/vote',
	     isAuthenticated,
	     hasParams(['vote']),
	     discussion.load,
	     discussion.createDiscussionVote);

    app.delete('/v1/discussion/:discussion/vote',
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

    app.delete('/v1/discussion/:discussion/comment/:comment',
	    isAuthenticated,
	    discussion.loadComment,
	    discussion.destroyComment);

    app.post('/v1/discussion/:discussion/comment/:comment/vote',
	     isAuthenticated,
	     hasParams(['vote']),
	     discussion.loadComment,
	     discussion.createCommentVote);

    app.delete('/v1/discussion/:discussion/comment/:comment/vote',
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

    app.put('/v1/group/:group',
	    isAuthenticated,
	    hasParams(['name', 'description']),
	    group.load,
	    group.update);

    app.get('/v1/group/:group/tracker',
	    isAuthenticated,
	    group.load,
	    group.tracker);

    app.post('/v1/group/:group/page/:page/track',
	     group.load,
	     page.load,
	     group.track);

    app.delete('/v1/group/:group/page/:page/track',
	       group.load,
	       page.load,
	       group.untrack);

    app.post('/v1/group/:group/subscription',
	     isAuthenticated,
	     group.load,
	     subscription.create);

    app.delete('/v1/group/:group/subscription',
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

    app.get('/v1/me/watching',
	    isAuthenticated,
	    me.watching);

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

    app.get('/v1/page/:page/vitamins',
	    isAuthenticated,
	    page.load,
	    page.vitamins);

    app.post('/v1/page/:page/track',
	     isAuthenticated,
	     page.load,
	     page.track);

    app.delete('/v1/page/:page/track',
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

    app.delete('/v1/prescription/:prescription',
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

    app.delete('/v1/user/:user/subscription',
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

    app.get('/v1/user/:user/pages',
	    isAuthenticated,
	    user.load,
	    user.pages);

    app.get('/v1/user/:user/crate',
	    isAuthenticated,
	    user.load,
	    user.crate);

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
	     vitamin.create,
	     vitamin.read);

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

    app.delete('/v1/vitamin/:vitamin/crate',
	    isAuthenticated,
	    vitamin.load,
	    crate.destroy);

    app.delete('/v1/vitamin/:vitamin/tag',
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
	res.sendStatus(200);
    });

    app.get('*', function (req, res) {
	res.status(404).send({
	    message: 'invalid endpoint: ' + req.url,
	    session: req.user
	});
    });

};
