var path = require('path');

module.exports = {
  url: 'http://localhost:9000',
  port: 8000,
  ssl: true,
  key: '/path/to/myserver.key',
  cert: '/path/to/bundle.crt',
  tmp: path.join(__dirname, '/../../tmp'),
  debug: true,
  echonest_key: '',
  ses: {
    key: '',
    secret: ''
  },
  invite: {
    secret: ''
  },
  reset: {
    secret: '',
    expires: '1d'
  },
  elasticsearch: {
    hosts: [
      'http://localhost:9200'
    ]
  },
  s3: {
    key: '',
    secret: '',
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
    charset: 'UTF8_GENERAL_CI'
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
    secret: '',
    expires: '7d'
  },
  stats: {
    prefix: 'vacay.api.',
    host: 'localhost',
    port: 8125,
    mock: true
  }
}
