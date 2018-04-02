/* global */

var Room = require('../modules/room'), 
    config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config);

var read = function(req, res) {
    var name = req.param('room');
    var room = Room(name);

    room.exists(function(err, exists) {
	if (err) {
	    log.error(err, res.locals.logRequest(req));
	    res.status(500).send({
		session: req.user,
		data: err
	    });	    
	    return;
	}

	if (!exists) {
	    res.status(404).send({
		session: req.user,
		data: 'invalid room id: ' + req.param('room')
	    });	    
	    return;
	}

	room.info(function(err, results) {
	    if (err) log.error(err, res.locals.logRequest(req));

	    results.room.users = results.users;

	    var withRelated = [
		'hosts',
		'artists'
	    ];

	    if (req.user) {
		withRelated.push({
		    'tags': function(qb) {
			qb.where('tags.user_id', req.user.id);
		    }
		}, {
		    'craters': function(qb) {
			qb.where('crates.user_id', req.user.id);
		    }
		});
	    }

	    var sendResponse = function() {
		res.status(err ? 500 : 200).send({
		    session: req.user,
		    data: err ? err : results.room
		});
	    };

	    if (!results.nowplaying) {
		sendResponse();
		return;
	    }

	    db.model('Vitamin').forge({
		id: results.nowplaying.id
	    }).fetch({
		withRelated: withRelated
	    }).asCallback(function(err, vitamin) {
		if (err) log.error(err, res.locals.logRequest(req));
		results.room.nowplaying = results.nowplaying;
		sendResponse();
	    });
	});
    });
};

module.exports = {
    read: read
};
