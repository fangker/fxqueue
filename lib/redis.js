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
        this.shutDown =false; 
        this._client = this.createClient();
    }

    get client() {
        return this._client;
    };
    get separator() {
        return this.redisConfig.separator;
    }

    createClient() {
        let client = redis.createClient(this.redisConfig.socket || this.redisConfig.port, this.redisConfig.host, this.redisConfig.options.options);
        client.select(this.redisConfig.db);
        client.on('error', function (err) {
            if(err){
                 if(this.shutDown==true){
                    return
             }else{
                 console.log(err)
             }
            }
        }.bind(this));
        return client;
    }
    createLockClient() {
        let client = redis.createClient(this.redisConfig.socket || this.redisConfig.port, this.redisConfig.host, this.redisConfig.options.options);
        client.select(4);
        client.on('error', function (err) {
            if(err){
                 if(this.shutDown==true){
                    return
             }else{
                 console.log(err)
             }
            }
        }.bind(this));
        return client;
    }
    getKey(key, separatyEnd) {
        let { prefix, separator } = this.redisConfig;
        let _key = prefix;
        if (arguments.length <= 2) {
            if (separatyEnd === undefined || separatyEnd === false) {
                _key = prefix + separator + key;
            } else if(separatyEnd===true) {
                _key = prefix+ separator + key + separator;
            }else{
                _key = prefix + separator + key + separator +separatyEnd;
            }
        } else {
            let argLen;
            (arguments[arguments.length - 1] === false)
                ? argLen = arguments.length - 1
                : argLen = arguments.length

            for (let i = 0; i <= argLen - 1; i++) {
                _key += separator + arguments[i]
            }
            if (arguments[arguments.length - 1] === true) {
                _key += separator;
            }
        }
        return _key.toString();

    }
    createZid(id) {
        let idLen = id.toString().length;
        if (idLen === 1) {
            idLen = '0' + idLen;
        }
        return idLen + '|' + id;
    }
    getIDfromZid(zid) {
        try {
            return zid.substring(zid.indexOf('|') + 1)
        } catch (e) {
            return null;
        }
    }
}

module.exports = RedisFactory;

