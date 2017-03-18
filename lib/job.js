const EventEmitter = require('events').EventEmitter;
let event = require("./queueEvent.js")
const priorities = { low: 10, normal: 0, medium: -5, high: -10, critical: -15 };
class Job extends EventEmitter {
    constructor(type, data, redis) {
        super();
        this.type = type;
        this.data = data || {};
        this.redis = redis;
        this.priority = 0;
        this._state = null;
        this.id = null;
        this.max_attempts = null;
        this.setMaxListeners(10);
        this._delay = null;
        this.args = null;
        this._ttl = null;
        this._attempts = 0;
        this.remaning = null;
        this._backoff = false;
        this.complete = false;
        this.created_at = null;
    }
    ttl(ms) {
        this._ttl = +ms | 0 || 0;
        return this;
    }
    on(event,callback) {
            super.on(event, function (msg) {
                callback(msg)
            })
    }
    attempts(num) {
        num = +num | 0 || 1;
        this.max_attempts = num;
        return this;
    }
    backoff(backoff) {
        this._backoff = backoff;
        return;
    }
    async save() {
        //get Id
        let id = await new Promise((resolve, reject) => {
            this.redis.client.incr('ids', (err, id) => {
                (!err)
                    ? resolve(id)
                    : reject(new Error('error'))

            })
        })
        //setIntoJob

        let object = await new Promise((resolve, reject) => {
            this.id = id;
            let multi = this.redis.client.multi();
            let hkey = this.redis.getKey('job', this.id);
            this.created_at = Date.now();
            multi.
                hset(hkey, 'created_at', Date.now())
                .hset(hkey, 'priority', this.priority)
                .hset(hkey, 'max_attempts', this.max_attempts)
                .hset(hkey, 'attempts', this._attempts)
                .hset(hkey, 'data', JSON.stringify(this.data))
                .hset(hkey, 'ttl', this._ttl)
                .hset(hkey, 'delay', this._delay)
                .hset(hkey, 'type', this.type)
                .exec((err, effectNum) => {
                    return resolve(effectNum)
                })
            this.addTypes();
            this.addIntoJobs();
            event.addObJob(this.id, this);
            if (this._delay) {
                return this.state('delay');
            }
            this._state = this._state || "inactive";
            this.state('inactive');
        });
        return this;
    }
    priority(level) {
        this.priority = priorities[level];
        if (this.id) {
            this.setJob('priority', this.priority)
            this.setJob('update_at', this.priority)
        }
        return this;
    }
    setJob(key, value) {
        this.redis.client.hset(this.redis.getKey('job', true) + this.id, key, JSON.stringify(value));
    }
    setType(key, value) {
        this.redis.client.hset(this.redis.getKey('job', true) + this.id, key, value.toString());
    }
    addTypes() {
        this.redis.client.sadd(this.redis.getKey('job', true) + 'types', this.type)
    }
    addIntoJobs() {
        this.redis.client.zadd(this.redis.getKey('jobs', false), this.priority, this.getZid())
    }
    getZid() {
        return this.redis.createZid(this.id);
    }
    Json() {
        const _json = {
            data: this.data,
            type: this.type,
            priority: this.priority,
            ttl: this._ttl,
            state: this._state,
            max_attempts:this.max_attempts,
            created_at:this.created_at,
            update_at:this.update_at||this.created_at,
            attempts:this._attempts,
            backoff:this._backoff
        }
        if(this.remaning!==null){
            _json['remaning']=this.remaning;
        }
        return _json;
    }
    async state(state, data) {
        if (arguments.length == 0 && !this._state) {
            return this._state;
        }
        let oldState = this._state;
        this._state = state;
        let job;
        if (this._state === null) this._state = "inactive";
        if (oldState != this._state) {
            //change state
            if (this._state === 'failed') {
                this._toFailed(data);
            }
            if (this._state === 'complete') {
                this._toComplete(data);
            }
            if (this._state === 'active') {
                job = this._toActive(this);
            }
            if (this._state === 'delay') {
                job = this._toDelay(this);
            }
            if (this._state === 'inactive') {
                job = this._toInactive(this);
            }
            if (this._state === 'retry') {
                job = this._toRetry(this);

            }
        } else {
            if (this._state === 'inactive') {
                job = this._inactiveState(this);
            }
        }
        let updated = new Promise((resolve, reject) => {
            this.redis.client.hset(this.redis.getKey('job', this.id), 'updated_at', Date.now(), function (err, effectNum) {
                resolve(effectNum);
            })
        })
        await updated;
        return job;
    }
    static getJob(id) {
        let worker = this;
        return new Promise((resolve, reject) => {
            let job = new Job();
            job.redis = worker.redis;
            job.id = parseInt(id);
            job.redis = worker.redis;
            worker.redis.client.hgetall(worker.redis.getKey('job', id, false), (err, hash) => {
                job.type = hash.type;
                job._ttl = hash.ttl || 0;
                job.priority = hash.priority;
                job._state = hash.state;
                job.created_at = hash.created_at;
                job.data = hash.data;
                job.updated_at = hash.updated_at;
                job.max_attempts = hash.max_attempts;
                job._attempts = hash.attempts || 1;
                if (hash.delay) {
                    job._delay = hash.delay;
                }
                //delay 
                if (hash.state == 'delay') {
                    job.state('inactive').then(job => {
                        //true
                        return resolve(job);
                    }).catch(err => {
                        return reject(err);
                    })

                }
                //retry
                if (hash.state == 'retry') {
                    job.state('inactive').then(job => {
                        //true
                        return resolve(job);
                    }).catch(err => {
                        return reject(err);
                    })

                }
                //active
                if (hash.state == 'inactive') {
                    job.state('active').then(job => {
                        //true
                        return resolve(job);
                    }).catch(err => {
                        return reject(err);
                    })
                }
                return resolve(job);
            })
        })
    }
    update() {

    }
    done(msg) {
        let getKey = this.redis.getKey.bind(this.redis);
        let multi = this.redis.client.multi();
        if (msg instanceof Error) {
            let err = msg.message;
            let stack = msg.stack;
            this.state('failed', { err, stack });
        }
        if ((msg instanceof Error) === false || msg === undefined) {
            this.state('complete', msg);
        }
    }
    delay(sec) {
        if (typeof sec === 'number') {
            this._delay = sec;
        } else {
            if (!isDate()) {
                throw new Error(` Date Invalid: ${sec} `)
            }
            this._delay = sec.getTime() - Date.now();
        }
        function isDate() {
            let date = new Date(sec)
                , is_date = isFinite(date.getTime()) && Date.now() < date.getTime()
            return is_date;
        }
        return this;
    }

    _toComplete(data) {
        let multi = this.redis.client.multi();
        let getKey = this.redis.getKey.bind(this.redis);
        let hkey = getKey('job', this.id, false)
        let self = this;
        multi
            .zrank(getKey('jobs', this.type, 'active'), this.getZid())
            .exec((err, num) => {
                if (num[0] === null) {
                    return
                }
                multi
                    .hset(hkey, 'state', 'complete')
                    .hset(hkey, 'updated_at', Date.now())
                    .hset(hkey, 'info', data || 0)
                    .hset(hkey, 'complete_at', Date.now())
                    .hdel(hkey, 'failed_at', 'stick', ' error')
                    .zadd(getKey('jobs', this.type, 'complete'), this.priority, this.getZid())
                    .zadd(getKey('jobs', 'complete'), this.priority, this.getZid())
                    .zrem(getKey('jobs', this.type, 'active'), this.getZid())
                    .zrem(getKey('jobs', 'active'), this.getZid())
                    .exec((err) => {
                        if (err)
                            throw new Error('error')
                        self.complete = true;
                        event.emit.bind(this)(this.id, 'complete', this.type)
                    });

            })
    }

    _toActive(job) {
        this._attempts=parseInt(this._attempts) + 1
         this.remaning= this.max_attempts-this._attempts;
        return new Promise((resolve, reject) => {
            let multi = this.redis.client.multi();
            let getKey = this.redis.getKey.bind(this.redis);
            let hkey = getKey('job', this.id, false)
            let zid = this.redis.createZid(this.id)
            let ttl;
            if (this._ttl)
                ttl = +this._ttl + Date.now();
            multi
                .hset(hkey, 'state', 'active')
                .hset(hkey, 'attempts', this._attempts )
                .zadd(getKey('jobs', this.type, 'active'), this.priority, zid)
                .zadd(getKey('jobs', 'active'), ttl || this.priority, zid)
                .zrem(getKey('jobs', 'inactive'), ttl || this.priority, zid)
                .exec((err) => {
                    if (err)
                        return reject(new Error('error'))
                    event.emit.bind(this)(this.id, 'active', this.type);
                    return resolve(job)
                })
        })
    }

    _toFailed(data) {
        let multi = this.redis.client.multi();
        let getKey = this.redis.getKey.bind(this.redis);
        let { err, stack } = data;
        let hkey = getKey('job', this.id, false);
        //集合不能出现重复数据
        multi
            .zadd(getKey('jobs', this.type, 'failed'), this.priority, this.getZid())
            .zadd(getKey('jobs', 'failed'), this.priority, this.getZid())
            .hset(hkey, 'error', err)
            .hset(hkey, 'stick', stack || 0)
            .hset(hkey, 'state', 'failed')
            .hset(hkey, 'failed_at', Date.now())
            .hset(hkey, 'updated_at', Date.now())
            .zrem(getKey('jobs', 'active'), this.getZid())
            .zrem(getKey('jobs', this.type, 'active'), this.getZid())
            .lpush(getKey('job', this.id, 'log'), err)
            .exec((error) => {
                if (error)
                    throw new Error('error')
                //notification
                event.emit.bind(this)(this.id, 'failed', this.type, { err: err, stack: stack || 0 })
                //重试
                this.state('retry');
            });
    }
    _toRetry() {
        let multi = this.redis.client.multi();
        let getKey = this.redis.getKey.bind(this.redis);
        if (parseInt(this.max_attempts) > parseInt(this._attempts)) {
            let delay;
            if (typeof this._backoff !== 'object' && this._backoff !== null&&this._backoff!==false) {
                delay = parseInt(this._delay) + Date.now();
            } else if (this._backoff !== null&&this._backoff!==false) {
                let { delay: delay } = this._backoff;
                if (delay) delay = delay + Data.now();
            } else {
                // is null
                this._state = 'inactive';
                return multi
                    .zrem(getKey('jobs', 'failed'), this.getZid())
                    .zrem(getKey('jobs', this.type, 'failed'), this.getZid())
                    .exec((err) => {
                        if (err)
                            throw new Error('error')
                        this.state('inactive');
                    })
            }
            multi
                .hset(getKey('job', this.id), 'state', this._state)
                .hset(getKey('job', this.id), 'delay', this._delay)
                .zadd(getKey('jobs', 'delayed'), delay, this.getZid())
                .zadd(getKey('jobs', this.type, 'delayed'), this.priority, this.getZid())
                // .zrem(getKey('jobs', this.type, 'delayed'), this.getZid())
                // .zrem(getKey('jobs:delayed'), this.getZid())
                .zrem(getKey('jobs', 'failed'), this.getZid())
                .zrem(getKey('jobs', this.type, 'failed'), this.getZid())
                .exec((err) => {
                    if (err)
                        throw new Error('error')
                    //notification
                    event.emit.bind(this)(this.id, 'retry', this.type, { retry_at: Date.now(), delay: delay })
                })
        }
    }

    _toInactive(job) {
        return new Promise((resolve, reject) => {
            let multi = this.redis.client.multi();
            let getKey = this.redis.getKey.bind(this.redis);
            let zid = this.redis.createZid(this.id);
            // 有序集合不支持 smove 方法 
            multi
                .zrem(getKey('jobs:delayed'), zid)
                .lpush(getKey(this.type, 'jobs'), 1)
                .zrem(getKey('jobs', this.type, 'delayed'), zid)
                .zadd(getKey('jobs', this.type, 'inactive'), this.priority, zid)
                .zadd(getKey('jobs:inactive'), this.priority, zid)
                .hset(getKey('job', this.id), 'state', 'inactive')
                .exec((err) => {
                    if (err) {
                        reject(new Error(err))
                    } else {
                        resolve(job);
                    }
                    //notification
                    event.emit.bind(this)(this.id, 'promotion', this.type, { promote_at: Date.now() });
                })
        })
    }
    _inactiveState(job) {
        let multi = this.redis.client.multi();
        let getKey = this.redis.getKey.bind(this.redis);
        return new Promise((resolve, reject) => {
            multi.lpush(getKey(this.type, 'jobs', false), 1)
                .hset(getKey('job', this.id, false), 'state', this._state)
                .zadd(getKey('jobs', this._state, false), this.ttl + Date.now(), this.getZid())
                .zadd(getKey('jobs', this.type, this._state, false), this.priority, this.getZid())
                .zadd(getKey('jobs', this._state, false), this.priority, this.getZid())
                .exec((err) => {
                    if (err) {
                        return reject(new Error('error'))
                    }
                    resolve(job)
                    //notification
                    event.emit.bind(this)(this.id, 'enqueue', this.type, this.args)
                })
        })
    }

    _toDelay() {
        let multi = this.redis.client.multi();
        let getKey = this.redis.getKey.bind(this.redis);
        multi
            .hset(getKey('job', this.id, false), 'state', this._state)
            .hset(getKey('job', this.id, false), 'delay', this._delay)
            .zadd(getKey('jobs', 'delayed', false), parseInt(this._delay) + Date.now(), this.getZid())
            .zadd(getKey('jobs', this.type, 'delayed', false), this.priority, this.getZid())
            .exec((err) => {
                if (err) {
                    throw new Error('error')
                }
                //notification
                event.emit.bind(this)(this.id, 'delay', this.type, this.args)
            })
    }
    args(...args) {
        this.args = Array.from(args);
        return this;
    }
}


module.exports = Job;