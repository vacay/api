/* global require, module, process */

var express = require('express'),
    cluster = require('cluster'),
    os = require('os'),
    config = require('config-api'),
    log = require('log')(config.log),
    routes = require('./routes'),
    elasticsearch = require('elasticsearch');

var app = module.exports = express(),
    server = require('http').createServer(app);

var es = new elasticsearch.Client(config.elasticsearch);

app.configure(function () {

    app.use(express.logger({
	format: config.log.express_format
    }));

    app.use(express.compress());

    app.use(express.json());
    app.use(express.urlencoded());
    app.use(express.methodOverride());

    app.use(function (req, res, next) {
	res.locals.es = es;
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

    app.use(app.router);

});

app.configure('development', function () {
    app.use(express.errorHandler({
	dumpExceptions: true,
	showStack: true
    }));
});

app.configure('production', function () {
    app.use(express.errorHandler());
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
