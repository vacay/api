/* global module */

module.exports = {
    title: 'vacay',
    host: 'localhost',
    port: 80,
    ssl: true,
    tmp: '/home/admin/vacay/shared/tmp',
    debug: false,
    
    s3: {
	key: 'AKIAJNZCI6UWMG3BNCVA',
	secret: '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',
	bucket: 'vcy',
	folder: 'production'
    },

    log: {
	level: 'info',
	express_format: '[:date] ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms ":referrer" :remote-addr',
	file: {
	    filename: '/home/admin/vacay/shared/log/default.log',
	    level: 'info',
	    maxsize: 10485760,
	    maxFiles: 1,
	    handleExceptions: true
	},
	mail: {
	    to: 'admin@vacay.io',
	    host : 'smtp.gmail.com',
	    port : 465,
	    secure : true,
	    username: 'admin@vacay.io',
	    password: 'Danger1$',
	    level: 'error',
	    handleExceptions: true
	}
    },

    mysql: {
	host: 'vcy.c5bdxy9dsboj.us-east-1.rds.amazonaws.com',
	port: 3306,
	database: 'vacay_production',
	user: 'root',
	password: 'Danger1$'
    },

    redis: {
	host: 'ec2-54-205-176-7.compute-1.amazonaws.com',
	port: 6379,
	pass: 'Danger1$'
    },

    session: {
	secret: 'hr{@"ca69EfN;*>J7wy:-yVs&^}]b1C]&96N|[[{^xb&<B>jp*%D[[7gEqaU]%Q}',
	maxAge: 86400000
    }    
};
