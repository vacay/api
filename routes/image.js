/* global module, require */

var request = require('request');

var proxy = function(req, res) {
    //TODO: validate head for content-type to check if image
    //TODO: and add a timeout
    //TODO: SECURITY VULNERABILITY! - move to another domain
    req.pipe(request({
	url: req.param('url'),
	encoding: 'base64'
    })).pipe(res);
};

module.exports = {
    proxy: proxy
};
