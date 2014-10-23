/* global require, process */

var config = require('config-api'),
    log = require('log')(config.log);

var express = require('express'),
    cluster = require('cluster'),
    redis = require('redis'),
    os = require('os'),
    kue = require('kue'),
    elasticsearch = require('elasticsearch'),
    onHeaders = require('on-headers'),
    StatsD = require('node-statsd').StatsD,
    socketioJwt = require('socketio-jwt'),
    bodyParser = require('body-parser'),
    compression = require('compression'),
    methodOverride = require('method-override'),
    morgan = require('morgan'),
    socketio = require('socket.io'),
    redisAdapter = require('socket.io-redis');

var socket = require('./modules/socket');
var routes = require('./routes');
var queue = kue.createQueue(config.queue);
var stats = new StatsD(config.stats);
var es = new elasticsearch.Client(config.elasticsearch);

var app = express();

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

app.disable('x-powered-by');
app.use(morgan(config.log.express_format));
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(methodOverride(function(req) {
    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
	// look in urlencoded POST bodies and delete it
	var method = req.body._method;
	delete req.body._method;
	return method;
    }
}));

app.use(function(req, res, next) {
    res.locals.es = es;
    res.locals.queue = queue;
    res.locals.logRequest = logRequest;
    res.locals.env = process.env.NODE_ENV ? process.env.NODE_ENV : 'development';
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

    // intercept OPTIONS method
    if ('OPTIONS' === req.method || '/health_check' === req.path) {
	res.send(200);
    } else {
	next();
    }
});

if (config.ssl) {
    app.use(function(req, res, next) {
	if (req.get('X-Forwarded-Proto') !== 'https') {
	    res.redirect('https://' + req.host + req.url);
	} else {
	    next();
	}
    });
}

app.use(function(req, res, next) {
    var start = process.hrtime();

    onHeaders(res, function() {
	var diff = process.hrtime(start);
	var ms = diff[0] * 1e3 + diff[1] * 1e-6;
	stats.timing('response', ms.toFixed());
    });

    next();
});

routes(app);

var port = config.port;
var env = process.env.NODE_ENV ? ('[' + process.env.NODE_ENV + ']') : '[development]';

var server = app.listen(port, function () {
    log.info(config.title + ' listening on ' + port + ' in ' + env);
});

var io = socketio(server, {
    serveClient: false
});

var pub = redis.createClient(config.redis.port, config.redis.host, {
    auth_pass: config.redis.auth_pass
});

var sub = redis.createClient(config.redis.port, config.redis.host, {
    detect_buffers: true,
    auth_pass: config.redis.auth_pass
});

io.adapter(redisAdapter({
    pubClient: pub,
    subClient: sub
}));

io.use(socketioJwt.authorize({
    secret: config.session.secret,
    handshake: true
}));

socket(io);
