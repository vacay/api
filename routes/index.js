/* global require, module */

var artist = require('./artist'),
    auth = require('./auth'),
    me = require('./me'),
    inbox = require('./inbox'),
    activity = require('./activity'),
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
    search = require('./search'),
    room = require('./room'),
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

var isAdmin = function(req, res, next) {
    if (req.user.username !== 't3rr0r') {
	res.status(401).send({
	    data: 'come on dude',
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
	    artist.load,
	    artist.read);

    app.get('/v1/artist/:artist/vitamins',
	    artist.load,
	    artist.vitamins);

    app.get('/v1/artist/:artist/originals',
	    artist.load,
	    artist.originals);

    app.get('/v1/artist/:artist/variations',
	    artist.load,
	    artist.variations);

    app.post('/v1/artist/:artist/subscription',
	    isAuthenticated,
	    artist.load,
	    subscription.create);

    app.delete('/v1/artist/:artist/subscription',
	   isAuthenticated,
	   artist.load,
	   subscription.destroy);

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
	    discussion.browse);

    app.post('/v1/discussion',
	     isAuthenticated,
	     hasParams(['title', 'description']),
	     discussion.create);

    app.get('/v1/discussion/:discussion',
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

    app.get('/v1/groups',
	    isAuthenticated,
	    group.browse);

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

    app.get('/v1/image',
	    isAuthenticated,
	    hasParams(['url']),
	    image.proxy);

    app.get('/v1/me',
	    isAuthenticated,
	    me.index);

    app.get('/v1/me/inbox',
	    inbox.index);

    app.get('/v1/me/activity',
	    isAuthenticated,
	    activity.index);

    app.post('/v1/me/sync',
	     hasParams(['ids']),
	     isAuthenticated,
	     me.sync);

    app.post('/v1/me/upload',
	     isAuthenticated,
	     hasParams(['ext']),
	     me.upload);

    app.post('/v1/message',
	     hasParams(['name', 'email', 'subject', 'body']),
	     message.create);

    app.get('/v1/pages',
	    isAuthenticated,
	    page.browse);

    //backward compatible for chrome ext
    //TODO - test auth
    app.post('/v1/page',
	     hasParams(['url']),
	     page.create,
	     page.read);

    app.get('/v1/page/:page',
	    page.load,
	    page.read);

    app.get('/v1/page/:page/vitamins',
	    page.load,
	    page.vitamins);

    app.post('/v1/page/:page/subscription',
	     isAuthenticated,
	     page.load,
	     subscription.create);

    app.delete('/v1/page/:page/subscription',
	    isAuthenticated,
	    page.load,
	    subscription.destroy);

    app.get('/v1/prescriptions',
	    prescription.browse);

    //TODO: validate vitamins to make sure they exist
    app.post('/v1/prescription',
	     isAuthenticated,
	     prescription.create,
	     prescription.read);

    app.get('/v1/prescription/:prescription',
	    prescription.load,
	    prescription.read);

    //TODO: validate vitamins to make sure they exist
    app.put('/v1/prescription/:prescription',
	    isAuthenticated,
	    prescription.update);

    app.delete('/v1/prescription/:prescription',
	       isAuthenticated,
	       prescription.load,
	       prescription.destroy);

    app.post('/v1/prescription/:prescription/vitamin',
	     isAuthenticated,
	     hasParams(['vitamin_id']),
	     prescription.addVitamin);

    app.delete('/v1/prescription/:prescription/vitamin',
	       isAuthenticated,
	       hasParams(['vitamin_id']),
	       prescription.destroyVitamin);

    app.post('/v1/prescription/:prescription/vote',
	     isAuthenticated,
	     prescription.load,
	     prescription.vote);

    app.delete('/v1/prescription/:prescription/vote',
	       isAuthenticated,
	       prescription.load,
	       prescription.destroyVote);

    app.get('/v1/room/:room',
	    isAuthenticated,
	    room.read);

    app.get('/v1/search/artists',
	    hasParams(['q']),
	    artist.browse);

    app.get('/v1/search/count',
	    hasParams(['q']),
	    search.count);

    app.get('/v1/search/pages',
	    hasParams(['q']),
	    page.browse);

    app.get('/v1/search/prescriptions',
	    hasParams(['q']),
	    prescription.browse);

    app.get('/v1/search/top',
	    hasParams(['q']),
	    search.top);

    app.get('/v1/search/users',
	    hasParams(['q']),
	    user.browse);

    app.get('/v1/search/vitamins',
	    hasParams(['q']),
	    vitamin.browse);

    app.get('/v1/search/youtube',
	    hasParams(['q']),
	    search.youtube);

    app.get('/v1/users',
	    isAuthenticated,
	    user.browse);

    app.post('/v1/user',
	     isAuthenticated,
	     hasParams(['email']),
	     user.create);

    app.get('/v1/user/:user',
	    user.load,
	    user.read);

    app.put('/v1/user/:user',
	    isAuthenticated,
	    user.load,
	    user.update);

    app.delete('/v1/user/:user',
	       isAuthenticated,
	       user.load,
	       user.destroy);

    app.get('/v1/user/:user/crate',
	    user.load,
	    user.crate);

    app.get('/v1/user/:user/drafts',
	    isAuthenticated,
	    me.drafts);

    app.get('/v1/user/:user/imports',
	    user.load,
	    user.imports);

    app.get('/v1/user/:user/listens',
	    user.load,
	    user.listens);

    app.get('/v1/user/:user/pages',
	    user.load,
	    user.pages);

    app.get('/v1/user/:user/prescriptions',
	    user.load,
	    user.prescriptions);

    app.get('/v1/user/:user/recommendations',
	    user.load,
	    user.recommendations);

    app.get('/v1/user/:user/recommended',
	    user.load,
	    user.recommended);

    app.post('/v1/user/:user/subscription',
	     isAuthenticated,
	     user.load,
	     subscription.create);

    app.delete('/v1/user/:user/subscription',
	       isAuthenticated,
	       user.load,
	       subscription.destroy);

    app.get('/v1/user/:user/summary',
	    user.load,
	    user.summary);

    app.get('/v1/user/:user/tags',
	    user.load,
	    user.tags);

    app.get('/v1/user/:user/tag',
	    user.load,
	    user.tag);

    app.get('/v1/user/:user/users',
	    user.load,
	    user.users);

    app.get('/v1/user/:user/watching',
	    isAuthenticated,
	    me.watching);

    app.get('/v1/vitamins',
	    isAuthenticated,
	    vitamin.browse);

    //TODO: remove auth ????????
    app.post('/v1/vitamin',
	     isAuthenticated,
	     hasParams(['url']),
	     vitamin.create,
	     vitamin.read);

    app.get('/v1/vitamin/:vitamin',
	    vitamin.load,
	    vitamin.read);

    app.put('/v1/vitamin/:vitamin',
	    isAuthenticated,
	    hasParams(['title']),
	    vitamin.load,
	    vitamin.update);

    app.delete('/v1/vitamin/:vitamin',
	       isAuthenticated,
	       isAdmin,
	       vitamin.load,
	       vitamin.destroy);

    app.post('/v1/vitamin/:vitamin/crate',
	     isAuthenticated,
	     vitamin.load,
	     crate.create);

    app.delete('/v1/vitamin/:vitamin/crate',
	    isAuthenticated,
	    vitamin.load,
	    crate.destroy);

    app.get('/v1/vitamin/:vitamin/stream',
	    vitamin.load,
	    vitamin.stream);

    app.post('/v1/vitamin/:vitamin/tag',
	     isAuthenticated,
	     hasParams(['value']),
	     vitamin.load,
	     crate.findOrCreate,
	     tag.create);

    app.delete('/v1/vitamin/:vitamin/tag',
	       isAuthenticated,
	       hasParams(['value']),
	       vitamin.load,
	       tag.destroy);

    app.post('/v1/logger', hasParams(['error']), function(req, res) {
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
