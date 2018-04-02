/* global __dirname, require, module */

var fs = require('fs');

var config;
var config_file = '/home/deploy/apps.json';

if (fs.existsSync(config_file)) {

  config = JSON.parse(fs.readFileSync(config_file));

  var db = config.servers.filter(function(s) {
    return s.normal.toquen.roles.indexOf('db') > -1;
  })[0];

  var monitor = config.servers.filter(function(s) {
    return s.normal.toquen.roles.indexOf('monitor') > -1;
  })[0];

  config.mysql.host = db.normal.toquen.internal_ip;
  config.redis.host = monitor.normal.toquen.internal_ip;
  config.queue = {
    redis: config.redis,
    disableSearch: true
  };
  config.stats = {
    prefix: 'vacay.api.',
    host: monitor.normal.toquen.internal_ip,
    port: 8125,
    mock: false
  };

} else {

  config = require('./config')

}

if (!config) {
  throw new Error('Application config missing');
}

module.exports = config;
