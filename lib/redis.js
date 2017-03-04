const EventEmitter = require('events').EventEmitter;
const redis = require('redis');
class RedisFactory extends EventEmitter {
    constructor(options, redisConfig) {
        super();
        if (options === undefined) options = {};
          this.redisConfig = {
            socket: redisConfig.socket || null,
            port: redisConfig.port || 6379,
            host: redisConfig.host || 'localhost',
            auth: redisConfig.auth || null,
            db: (+redisConfig.db | 0 || 0) || 3,
            options: redisConfig.options || {},
            prefix: options.prefix || 'q',
            separator: options.separator || ':'
        }
        this._client = this.createClient();
    }

    get client() {
        return this._client;
    };

    get separator() {
        return this.redisConfig.separator;
    }

    createClient() {
        console.log('create');
        let client = redis.createClient(this.redisConfig.socket || this.redisConfig.port, this.redisConfig.host, this.redisConfig.options.options);
        client.select(this.redisConfig.db);
        client.on('error', function (err) {
            //抛出错误
            console.log(err,'err');
        });
        return client;
    }
    getKey(key, separatyEnd) {
        let {prefix, separator} = this.redisConfig;
                let _key = prefix;
        if (arguments.length <= 2) {
            if (separatyEnd === undefined || separatyEnd === false) {
                _key = prefix + separator + key;
            } else {
                _key = prefix + separator + key + separator;
            }
        } else {
            for (let i = 0; i <= arguments.length - 1; i++) {
                _key += separator + arguments[i]
            }
            if (arguments[arguments.length - 1] === true) {
                _key += separator;
            }
        }
        return _key.toString();

    }
    reSet() {
        this._client = this._client.quit()
        this._client = this.creatClient();
    }
    createZid(id) {
        let idLen = id.toString().length;
        if (idLen === 1) {
            idLen = '0' + idLen;
        }
        return idLen + '|' + id;
    }
    getIDfromZid(zid) {
        return zid.substring(zid.indexOf('|') + 1)
    }
    static client() {
        let client = redis.createClient(this.redisConfig.socket || this.redisConfig.port, this.redisConfig.host, this.redisConfig.options.options);
        client.select(this.redisConfig.db);
        client.on('error', function (err) {
            //抛出错误
            console.log(err,'err');
        });
        return client;
    }

}

module.exports = RedisFactory;
