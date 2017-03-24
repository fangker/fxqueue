const event = require('./queueEvent');
const EventEmitter = require('events').EventEmitter;
class schema extends EventEmitter {
    constructor(type, data, redis, warlock) {
        super();
        this._ttl = null;
        this.timeStamp = null;
        this.redis = redis;
        this.id = null;
        this.type = type;
        this.data = data;
        this.only = false;
        this.warlock = warlock;
    }
    ttl(ttl) {
        this._ttl = +ttl|0||0;
        return this;
    }
    on(event) {
        return new Promise((resolve) => {
            super.on(event, function (_msg, msg) {
                //msg->[ 'q', 'schema', 'type','id', { name: 'lisi' } ]
                this.type = _msg[2];
                this.id = _msg[3]
                this.data = _msg[4];
                this.keyString = msg;
                this.confirmed()
            }.bind(this))
        })
    }
    confirmed(){
            let redis =this.redis
            redis.client.hset(redis.getKey('schema',this.id),'state','confirmed',(err)=>{
                if(err){
                    throw  new Error(err);
                }
            })
    }
    done() {
        return new Promise((resolve) => {
            let multi = this.redis.client.multi();
            multi.lrem(this.redis.getKey('schema', this.type), 1, this.keyString)
                .zrem(this.redis.getKey('unconfirmed', 'schema'), this.redis.createZid(this.id))
                .del(this.redis.getKey('schema',this.id))
                .exec((err) => {
                    if (err)
                        throw new Error(err);
                })
        })
    }
    async save() {
        let multi = this.redis.client.multi();
        let id = await new Promise((resolve) => {
            this.redis.client.incr('ids', (err, id) => {
                (!err)
                    ? resolve(id)
                    : reject(new Error('error'))
            })
        })
        this.id = id;
        let stringKey = this.redis.getKey('schemas', this.type, id, JSON.stringify(this.data));
        multi
            .zadd(this.redis.getKey('unconfirmed', 'schema'), this.timeStamp, this.redis.createZid(id))
            .zadd(this.redis.getKey('schemas'), this.timeStamp, this.redis.createZid(id))
            .set(stringKey, 1)
            .expire(stringKey, Math.round(this._ttl / 1000))
            .lpush(this.redis.getKey(this.type,'schemas'), stringKey)
            .hset(this.redis.getKey('schema',this.id),'ttl',this._ttl)
            .hset(this.redis.getKey('schema',this.id),'schedule',this.timeStamp)
            .hset(this.redis.getKey('schema',this.id),'data',JSON.stringify(this.data))
            .hset(this.redis.getKey('schema',this.id),'state','unconfirmed')
            .hset(this.redis.getKey('schema',this.id),'type',this.type)
            .exec((err) => {
                if (err)
                    throw new Error(err)
            })
        return id;
    }
    schedule(date) {
        if (typeof date === 'number') {
            this.timeStamp = date+Date.now();
        } else {
            if (!isDate()) {
                throw new Error(` Date Invalid: ${date} `)
            }
            this.timeStamp = date.getTime()
        }
        function isDate() {
            let is_date;
             date = new Date(date)
                , is_date = isFinite(date.getTime()) && Date.now() < date.getTime()
            return is_date;
        }
        return this;
    }
    subType(only) {
        if (only) {
            this.only = true;
            this.lockType();
        } else {
            event.addSubMap(this.type, this);
        }
        return this;
    }
    lockType() {
        let self = this
            , lockTtl = 20000
            , timeout = 1000
        setImmediate(function () {
            self.warlock.lock(`schema${self.type}`, lockTtl, function (err, unlock) {
                if (err) return;
                if (typeof unlock === 'function') {
                    //可以监听，增加到监听列表
                    if (event.hasSubMap(self.type) === false) {
                        event.addSubMap(self.type, self)
                    } else {
                        return;
                    }
                }
            })

        }, timeout)
    }
}

module.exports = schema;