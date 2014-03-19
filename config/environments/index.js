/* global __dirname, process, require, module */

var config_file = './' + (process.env.NODE_ENV ? process.env.NODE_ENV : 'development') + '.js',
    config;

try {
    config = require(config_file);
} catch (err) {
    if (err.code && err.code === 'MODULE_NOT_FOUND') {
	throw 'No config file matching NODE_ENV=' + process.env.NODE_ENV + '. Requires "' + __dirname + '/' + process.env.NODE_ENV + '.js"';
    } else {
	throw err;
    }
}

module.exports = config;
