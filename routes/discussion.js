/* global require, module */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config);

var nestComments = function(comments) {

    var i, len, roots = [], children = {};

    // find the top level nodes and hash the children based on parent
    for (i = 0, len = comments.length; i < len; i++) {
        var item = comments[i],
            p = item.parent_id,
            target = !p ? roots : (children[p] || (children[p] = []));

        target.push(item);
    }

    // function to recursively build the tree
    var findChildren = function(parent) {
        if (children[parent.id]) {
            parent.comments = children[parent.id];
            for (var i = 0, len = parent.comments.length; i < len; ++i) {
                findChildren(parent.comments[i]);
            }
        } else {
	    parent.comments = [];
	}
    };

    // enumerate through to handle the case where there are multiple roots
    for (i = 0, len = roots.length; i < len; ++i) {
        findChildren(roots[i]);
    }

    return roots;
};

var browse = function(req, res) {
    var offset = parseInt(req.param('offset'), 10) || 0;
    db.model('Discussion')
	.collection()
	.query(function(qb) {
	    qb.limit(20).offset(offset).orderBy('updated_at', 'desc');
	})
	.fetch({
	    withRelated: [
		'user',
		'comments',
		'votes'
	    ]
	}).exec(function(err, discussions) {
	    if (err) log.error(err, res.locals.logRequest(req));
	    res.send(err ? 500 : 200, {
		session: req.user,
		data: discussions.toJSON()
	    });
	});
};

var load = function(req, res, next) {
    db.model('Discussion').findOne({
	id: req.param('discussion')
    }).exec(function(err, discussion) {
	if (err || !discussion) {
	    if (err) log.error(err, res.locals.logRequest(req));
	    res.send(err ? 500 : 404, {
		session: req.user,
		data: err ? err : 'invalid discussion id: ' + req.param('discussion')
	    });
	} else {
	    res.locals.discussion = discussion;
	    next();
	}
    });
};

var read = function(req, res) {
    res.locals.discussion.fetch({
	withRelated: [
	    'user',
	    'votes',
	    'comments',
	    'comments.user',
	    'comments.votes'
	]
    }).exec(function(err, discussion) {
	if (err) log.error(err, res.locals.logRequest(req));
	var data = discussion ? discussion.toJSON() : {};
	if (data) {
	    data.comments = nestComments(data.comments);
	}
	console.log(data);
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : data
	});
    });
};

var update = function(req, res) {
    db.model('Discussion').edit({
	id: req.param('discussion'),
	title: req.param('title'),
	description: req.param('description')
    }).exec(function(err, discussion) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : discussion.toJSON()
	});
    });
};

var create = function(req, res) {
    //TODO: validate title length
    //TODO: validate description length
    db.model('Discussion').create({
	user_id: req.user.id,
	title: req.param('title'),
	description: req.param('description')
    }).exec(function(err, discussion) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: discussion.toJSON()
	});
    });
};

var createComment = function(req, res) {
    //TODO: validate body length
    db.model('Comment').create({
	user_id: req.user.id,
	body: req.param('body'),
	discussion_id: req.param('discussion'),
	parent_id: req.param('parent_id') || null
    }).exec(function(err, discussion) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: discussion.toJSON()
	});
    });

};

var loadComment = function(req, res, next) {
    db.model('Comment').findOne({
	id: req.param('comment')
    }).exec(function(err, comment) {
	if (err || !comment) {
	    if (err) log.error(err, res.locals.logRequest(req));
	    res.send(err ? 500 : 404, {
		session: req.user,
		data: err ? err : 'invalid discussion id: ' + req.param('comment')
	    });
	} else {
	    res.locals.comment = comment;
	    next();
	}
    });
};

var updateComment = function(req, res) {
    db.model('Comment').edit({
	id: req.param('comment'),
	body: req.param('body')
    }).exec(function(err, comment) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : comment.toJSON()
	});
    });
};

var createDiscussionVote = function(req, res) {
    db.model('Vote').findOne({
	user_id: req.user.id,
	voteable_id: res.locals.discussion.id,
	voteable_type: 'discussions'
    }).exec(function(err, vote) {
	if (vote && vote.attributes.vote === req.param('vote')) {
	    res.send(200, {
		session: req.user,
		data: vote.toJSON()
	    });
	    return;
	}

	var model = db.model('Vote').forge({
	    user_id: req.user.id,
	    voteable_id: res.locals.discussion.id,
	    voteable_type: 'discussions'
	});

	if (vote) {
	    model.query('where', {
		user_id: req.user.id,
		voteable_id: res.locals.discussion.id,
		voteable_type: 'discussions'
	    });
	}

	model.save({
	    vote: req.param('vote')
	}, {
	    method: vote ? 'update' : 'insert',
	    patch: true
	}).exec(function(err, vote) {
	    if (err) log.error(err, res.locals.logRequest(req));
	    res.send(err ? 500 : 200, {
		session: req.user,
		data: err ? err : vote.toJSON()
	    });
	});
    });
};

var destroyDiscussionVote = function(req, res) {
    db.model('Vote').forge().query('where', {
	user_id: req.user.id,
	voteable_id: res.locals.discussion.id,
	voteable_type: 'discussions'
    }).destroy().exec(function(err, vote) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : vote.toJSON()
	});
    });	
};

var createCommentVote = function(req, res) {
    db.model('Vote').forge({
	user_id: req.user.id,
	voteable_id: res.locals.comment.id,
	voteable_type: 'comments'
    }).save({vote: req.param('vote')}, {patch: true}).exec(function(err, vote) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.send(err ? 500 : 200, {
	    session: req.user,
	    data: err ? err : vote.toJSON()
	});
    });
};

module.exports = {
    browse: browse,
    load: load,
    create: create,
    read: read,
    update: update,
    createDiscussionVote: createDiscussionVote,
    destroyDiscussionVote: destroyDiscussionVote,
    loadComment: loadComment,
    createComment: createComment,
    updateComment: updateComment,
    createCommentVote: createCommentVote
};
