/* global require, module, process */

var express = require('express'),
    cluster = require('cluster'),
    os = require('os'),
    config = require('config-api'),
    log = require('log')(config.log),
    queue = require('queue')(config.redis),
    routes = require('./routes'),
    elasticsearch = require('elasticsearch'),
    onHeaders = require('on-headers'),
    StatsD = require('node-statsd').StatsD;

var stats = new StatsD(config.stats);

var app = module.exports = express(),
    server = require('http').createServer(app);

var es = new elasticsearch.Client(config.elasticsearch);

var logRequest = function(req) {
    stats.increment('error');
    return {
	url: req.url,
	headers: req.headers,
	method: req.method,
	originalUrl: req.originalUrl,
	query: req.query,
	httpVersion: req.httpVersion
    };
};

app.configure(function () {

    app.disable('x-powered-by');

    app.use(express.logger({
	format: config.log.express_format
    }));

    app.use(express.compress());

    app.use(express.json());
    app.use(express.urlencoded());
    app.use(express.methodOverride());

    app.use(function (req, res, next) {
	res.locals.es = es;
	res.locals.queue = queue;
	res.locals.logRequest = logRequest;
	res.locals.env = process.env.NODE_ENV ? process.env.NODE_ENV : 'development';
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

	// intercept OPTIONS method
	if ('OPTIONS' === req.method) {
	    res.send(200);
	} else {
	    next();
	}
    });

    if (config.ssl) {
	app.use(function(req, res, next) {
	    if (req.path !== '/health_check' && req.get('X-Forwarded-Proto') !== 'https') {
		res.redirect('https://' + req.host + req.url);
	    } else {
		next();
	    }
	});
    }

    app.use(function(req, res, next) {
	var start = process.hrtime();;

	onHeaders(res, function() {
	    var diff = process.hrtime(start);
	    var ms = diff[0] * 1e3 + diff[1] * 1e-6;
	    stats.timing('response', ms.toFixed());
	});

	next();
    });

    app.use(app.router);

});

routes(app);

var startApp = function () {
    var port = config.port;
    var env = process.env.NODE_ENV ? ('[' + process.env.NODE_ENV + ']') : '[development]';
    
    server.listen(port, function () {
	log.info(config.title + ' listening on ' + port + ' in ' + env);
    });
};

var startCluster = function (onWorker, onExit) {
    if (cluster.isMaster) {
	log.info('Initializing ' + os.cpus().length + ' workers in this cluster.');
	for (var i = 0; i < os.cpus().length; i++) {
	    cluster.fork();
	}
	cluster.on('exit', onExit);
    } else {
	onWorker();
    }
};

var restartApp = function(worker, code, signal) {
    log.info('worker %d died, code (%s). restarting worker...', worker.process.pid, code);
    cluster.fork();
};

startCluster(startApp, restartApp);
