/* global __dirname, require, module */
var path = require('path');

module.exports = {
    title: 'vacay',
    host: 'localhost',
    port: 8000,
    ssl: false,
    tmp: path.join(__dirname, '/../../tmp'),
    debug: true,
    
    s3: {
	key: 'AKIAJNZCI6UWMG3BNCVA',
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
	charset  : 'utf8'
    },
    
    redis: {
	host: '127.0.0.1',
	port: 6379
    },
    
    session: {
	secret: 'hr{@"ca69EfN;*>J7wy:-yVs&^}]b1C]&96N|[[{^xb&<B>jp*%D[[7gEqaU]%Q}',
	maxAge: 60
    }
};
