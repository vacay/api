/* global module */

module.exports = {
    title: 'vacay',
    host: 'localhost',
    port: 80,
    ssl: true,
    tmp: '/home/deploy/vacay/shared/tmp',
    debug: false,
    
    s3: {
	key: 'AKIAJNZCI6UWMG3BNCVA',
	secret: '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',
	bucket: 'vcy',
	folder: 'production'
    },

    log: {
	level: 'info',
	express_format: '[:date] ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms ":referrer" :remote-addr'
    },

    mysql: {
	host: 'ip-172-31-17-201.ec2.internal',
	port: 3306,
	database: 'vacay_production',
	user: 'root',
	password: 'Danger1$'
    },

    redis: {
	host: 'ip-172-31-31-5.ec2.internal',
	port: 6379,
	pass: 'Danger1$'
    },

    session: {
	secret: 'hr{@"ca69EfN;*>J7wy:-yVs&^}]b1C]&96N|[[{^xb&<B>jp*%D[[7gEqaU]%Q}',
	maxAge: 86400000
    }    
};
