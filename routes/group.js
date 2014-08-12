/* global module, require */

var config = require('config-api'),
    log = require('log')(config.log),
    db = require('db')(config);

var load = function(req, res, next) {
    db.model('Group').findOne({
	id: req.param('group')
    }).exec(function(err, group) {
	if (err) {
	    log.error(err, res.locals.logRequest(req));
	    res.send(500, {
		session: req.user,
		data: err
	    });
	} else if (!group) {
	    res.send(404, {
		session: req.user,
		data: 'invalid group id: ' + req.param('group')
	    });
	} else {
	    res.locals.group = group;
	    next();
	}
    });
};

module.exports = {
    load: load
};
