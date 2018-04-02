var async = require('async'),
    config = require('config-api'),
    redis = require('redis');

var client = redis.createClient(config.redis.port, config.redis.host, config.redis.options);

module.exports = function(n) {
    var name = 'r:' + n;
    return {
	exists: function(cb) {
	    client.exists(name, cb);
	},
	hasUser: function(username, cb) {
	    client.hexists(name + ':users', username, cb);
	},
	info: function(cb) {
	    async.parallel({
		users: this.users.bind(this),
		room: this.get.bind(this),
		nowplaying: this.nowplaying.bind(this)
	    }, cb);
	},
	nowplaying: function(cb) {
	    client.get(name + ':nowplaying', function(err, data) {
		if (data) data = JSON.parse(data);
		cb(err, data);
	    });
	},
	users: function(cb) {
	    client.hvals(name + ':users', function(err, data) {
		if (data) {
		    data = data.map(function(d) {
			return JSON.parse(d);
		    });
		}
		cb(err, data);
	    });
	},
	usernames: function(cb) {
	    client.hkeys(name + ':users', cb);
	},
	get: function(cb) {
	    client.get(name, function(err, data) {
		if (data) data = JSON.parse(data);
		cb(err, data);
	    });
	},
	create: function(data, cb) {
	    var o = {
		name: data.name,
		master: data.username,
		listed: data.listed,
		shared: data.shared
	    };
	    client.set('r:' + data.name, JSON.stringify(o), cb);
	},
	destroy: function(cb) {
	    client.keys(name + '*', function(err, rows) {
		if (err) {
		    cb(err);
		    return;
		}

		async.each(rows, function(r, next) {
		    client.del(r,next);
		}, cb);
	    });
	},
	sync: function(io, cb) {
	    var self = this;
	    async.parallel({
		users: self.usernames.bind(self),
		room: self.get.bind(self)
	    }, function(err, results) {
		if (err) {
		    cb(err);
		    return;
		}

		results.users.forEach(function(u) {
		    io.to(u).emit('room', results.room);
		});

		if (!results.users.length) self.destroy(cb);
		else cb();
	    });
	},
	join: function(data, cb) {
	    var self = this;
	    var addUser = function(err) {
		if (err) {
		    cb(err);
		    return;
		}

		client.set('u:' + data.username + ':room', n);
		client.hset(name + ':users', data.username, JSON.stringify(data.user), function(err) {
		    cb(err);
		});
	    };

	    self.exists(function(err, value) {
		if (err) {
		    cb(err);
		    return;
		}

		if (!value) self.create(data, addUser);
		else addUser();
	    });
	},
	leave: function(username, cb) {
	    client.del('u:' + username + ':room');
	    client.hdel(name + ':users', username, cb);
	}
    };
};
