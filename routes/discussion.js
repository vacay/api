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
    var limit = parseInt(req.param('limit'), 10) || 20;

    if (limit < 0 || limit > 20) limit = 20;
    var closed = req.param('closed') ? (req.param('closed') === 'true' ? true : false) : false;
    var is_sticky = req.param('sticky') ? (req.param('sticky') === 'true' ? true : false) : undefined;

    db.model('Discussion')
	.collection()
	.query(function(qb) {
	    qb.select(db.knex.raw('discussions.*, count(comments.id) as total_comments'))
		.leftJoin('comments', 'discussions.id', 'comments.discussion_id')
		.where('discussions.closed', closed)
		.groupBy('discussions.id')
		.limit(limit).offset(offset).orderBy('discussions.updated_at', 'desc');

	    if (typeof is_sticky !== 'undefined')
		qb.where('discussions.is_sticky', is_sticky);
	}).fetch({
	    withRelated: [
		'user',
		'votes'
	    ]
	}).asCallback(function(err, discussions) {
	    if (err) log.error(err, res.locals.logRequest(req));
	    res.status(err ? 500 : 200).send({
		session: req.user,
		data: err ? err : discussions.toJSON()
	    });
	});
};

var load = function(req, res, next) {
    db.model('Discussion').findOne({
	id: req.param('discussion')
    }).asCallback(function(err, discussion) {
	if (err || !discussion) {
	    if (err) log.error(err, res.locals.logRequest(req));
	    res.status(err ? 500 : 404).send({
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
	    'watchers',
	    'votes',
	    'comments',
	    'comments.user',
	    'comments.votes'
	]
    }).asCallback(function(err, discussion) {
	if (err) log.error(err, res.locals.logRequest(req));

	var data = discussion ? discussion.toJSON() : {};
	if (data) {
	    data.total_comments = data.comments.length;
	    data.comments = nestComments(data.comments);
	}

	res.status(err ? 500 : 200).send({
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
    }).asCallback(function(err, discussion) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
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
    }).asCallback(function(err, discussion) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : discussion.toJSON()
	});
    });
};

var watchDiscussion = function(req, res) {
    db.knex('discussions_users').insert({
	discussion_id: res.locals.discussion.id,
	user_id: req.user.id
    }).asCallback(function(err, row) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: row
	});
    });
};

var unwatchDiscussion = function(req, res) {
    db.knex('discussions_users').where({
	discussion_id: res.locals.discussion.id,
	user_id: req.user.id
    }).del().asCallback(function(err, rows) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: rows
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
    }).asCallback(function(err, comment) {
	if (err) log.error(err, res.locals.logRequest(req));
	else {
	    comment.set({
		votes: [],
		comments: []
	    });
	}

	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : comment.toJSON()
	});
    });

};

var loadComment = function(req, res, next) {
    db.model('Comment').findOne({
	id: req.param('comment')
    }).asCallback(function(err, comment) {
	if (err || !comment) {
	    if (err) log.error(err, res.locals.logRequest(req));
	    res.status(err ? 500 : 404).send({
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
    }).asCallback(function(err, comment) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : comment.toJSON()
	});
    });
};

var destroyComment = function(req, res) {
    db.model('Comment').edit({
	id: req.param('comment'),
	body: 'deleted',
	user_id: 0
    }).asCallback(function(err, comment) {
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
    }).asCallback(function(err, vote) {
	if (vote && vote.attributes.vote === req.param('vote')) {
	    res.status(200).send({
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
	}).asCallback(function(err, vote) {
	    if (err) log.error(err, res.locals.logRequest(req));
	    res.status(err ? 500 : 200).send({
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
    }).destroy().asCallback(function(err, vote) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
	    session: req.user,
	    data: err ? err : vote.toJSON()
	});
    });
};

var createCommentVote = function(req, res) {
    db.model('Vote').findOne({
	user_id: req.user.id,
	voteable_id: res.locals.comment.id,
	voteable_type: 'comments'
    }).asCallback(function(err, vote) {
	if (vote && vote.attributes.vote === req.param('vote')) {
	    res.status(200).send({
		session: req.user,
		data: vote.toJSON()
	    });
	    return;
	}

	var model = db.model('Vote').forge({
	    user_id: req.user.id,
	    voteable_id: res.locals.comment.id,
	    voteable_type: 'comments'
	});

	if (vote) {
	    model.query('where', {
		user_id: req.user.id,
		voteable_id: res.locals.comment.id,
		voteable_type: 'comments'
	    });
	}

	model.save({
	    vote: req.param('vote')
	}, {
	    method: vote ? 'update' : 'insert',
	    patch: true
	}).asCallback(function(err, vote) {
	    if (err) log.error(err, res.locals.logRequest(req));
	    res.status(err ? 500 : 200).send({
		session: req.user,
		data: err ? err : vote.toJSON()
	    });
	});
    });

};

var destroyCommentVote = function(req, res) {
    db.model('Vote').forge().query('where', {
	user_id: req.user.id,
	voteable_id: res.locals.comment.id,
	voteable_type: 'comments'
    }).destroy().asCallback(function(err, vote) {
	if (err) log.error(err, res.locals.logRequest(req));
	res.status(err ? 500 : 200).send({
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
    watch: watchDiscussion,
    unwatch: unwatchDiscussion,
    createDiscussionVote: createDiscussionVote,
    destroyDiscussionVote: destroyDiscussionVote,
    loadComment: loadComment,
    createComment: createComment,
    updateComment: updateComment,
    destroyComment: destroyComment,
    createCommentVote: createCommentVote,
    destroyCommentVote: destroyCommentVote
};
