/* global __dirname, require, module */

var fs = require('fs');
var path = require('path');

var config;
var config_file = '/home/deploy/vacay/shared/apps.json';

if (fs.existsSync(config_file)) {

    config = JSON.parse(fs.readFileSync(config_file));

    var db = config.servers.filter(function(s) {
	return s.roles.indexOf('db') > -1;
    })[0];

    var monitor = config.servers.filter(function(s) {
	return s.roles.indexOf('monitor') > -1;
    })[0];

    var elasticsearch = config.servers.filter(function(s) {
	return s.roles.indexOf('search') > -1;
    });

    var elasticsearch_hosts = [];
    for (var e=0; e<elasticsearch.length; e++) {
	elasticsearch_hosts.push(elasticsearch[e].internal_ip + ':9200');
    }

    config.mysql.host = db.internal_ip;
    config.elasticsearch = {
	hosts: elasticsearch_hosts
    };
    config.redis.host = monitor.internal_ip;
    config.queue = {
	redis: config.redis,
	disableSearch: true
    };
    config.stats = {
	prefix: 'vacay.api.',
	host: monitor.internal_ip,
	port: 8125,
	mock: false
    };

} else {

    config = {
	url: 'http://localhost:9000',
	port: 8000,
	tmp: path.join(__dirname, '/../../tmp'),
	debug: true,
	reset: {
	    secret: 'AWRO7Na+EgvvBA==',
	    expires: 1440 //minutes
	},
	elasticsearch: {
	    hosts: [
		'http://localhost:9200'
	    ]
	},
	s3: {
	    key: 'AKIAIAQL5YQHQISA76FQ',
	    secret: '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',
	    bucket: 'vacay',
	    folder: 'development'
	},
	log: {
	    level: 'debug',
	    express_format: '[:date] ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms ":referrer" :remote-addr'
	},	
	mysql: {
	    database: 'vacay_development',
	    host: 'localhost',
	    port: 3306,
	    user: 'root',
	    charset  : 'UTF8_GENERAL_CI'
	},
	redis: {
	    host: '127.0.0.1',
	    port: 6379
	},
	queue: {  
	    redis: {
		host: '127.0.0.1',
		port: 6379
	    },
	    disableSearch: true
	},
	session: {
	    secret: 'hr{@"ca69EfN;*>J7wy:-yVs&^}]b1C]&96N|[[{^xb&<B>jp*%D[[7gEqaU]%Q}'
	},
	stats: {
	    prefix: 'vacay.api.',
	    host: 'localhost',
	    port: 8125,
	    mock: true
	}
    };
}

if (!config) {
    throw new Error('Application config missing');
}

module.exports = config;
