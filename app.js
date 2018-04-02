/* global require, process */

var fs		= require('fs')
var config	= require('config-api')
var log		= require('log')(config.log)

var express		= require('express')
var elasticsearch	= require('elasticsearch')
var onHeaders		= require('on-headers')
var StatsD		= require('node-statsd').StatsD
var socketioJwt		= require('socketio-jwt')
var bodyParser		= require('body-parser')
var compression		= require('compression')
var methodOverride	= require('method-override')
var morgan		= require('morgan')
var socketio		= require('socket.io')
var redis		= require('redis')
var https		= require('https')

var email	= require('vacay-email')
var socket	= require('./modules/socket')
var routes	= require('./routes')
var stats	= new StatsD(config.stats)
var es		= new elasticsearch.Client(config.elasticsearch)
var client	= redis.createClient(config.redis.port, config.redis.host, config.redis.options)

client.on('error', function(err) {
  log.error('redis error: ', err);
});

stats.socket.on('error', function(err) {
  return log.error('statsd error: ', err);
});

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
  res.locals.redis = client;
  res.locals.sendEmail = email({ses : config.ses})
  res.locals.logRequest = logRequest;
  res.locals.env = process.env.NODE_ENV ? process.env.NODE_ENV : 'development';
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

  // intercept OPTIONS method
  if ('OPTIONS' === req.method || '/health_check' === req.path) {
    res.sendStatus(200);
  } else {
    next();
  }
});

if (config.ssl) {
  app.use(function(req, res, next) {
    if (!req.secure) {
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
var sslOptions = {
  key: fs.readFileSync(config.key),
  cert: fs.readFileSync(config.cert)
}
var server = https.createServer(sslOptions, app);

var io = socketio(server, {
  serveClient: false
});

io.use(socketioJwt.authorize({
  secret: config.session.secret,
  handshake: true
}));

socket(io, client);

server.listen(port, function () {
  log.info('listening on ' + port + ' in ' + env);
});
