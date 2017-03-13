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
        this.max_attempts = 1;
        this.setMaxListeners(10);
        this._dealy = null;
        this.args = null;
        this._ttl = null;
        this.attempts =1;
    }
      ttl(ms){
        this._ttl=+ms|0||0;
        return this;
    }
    on(event) {
        return new Promise((resolve) => {
            super.on(event, function (msg) {
                resolve(msg);
            })
        })
    }
    save() {
        //get Id
        new Promise((resolve, reject) => {
            this.redis.client.incr('ids', (err, id) => {
                (!err)
                    ? resolve(id)
                    : reject(new Error('error'))

            })
        })
            //setIntoJob
            .then((id) => {
              return  new Promise((resolve,reject)=>{
                    this.id = id;
                let multi = this.redis.client.multi();
                let hkey = this.redis.getKey('job',this.id);
                multi.
                 hset(hkey,'created_at',Date.now() )
                .hset(hkey,'priority', this.priority)
                .hset(hkey,'max_attempts', this.max_attempts)
                .hset(hkey,'max_attempts', this.attempts||1)
                .hset(hkey,'data', JSON.stringify(this.data))
                .hset(hkey,'ttl', this._ttl)
                .hset(hkey,'type', this.type)
                .exec((err,effectNum)=>{
                  return  resolve(effectNum)
                })
               this.addTypes();
                this.addIntoJobs();
                });
                
            })
            //set state and refresh it
            .then(() => {
                //add to obJob
                let self = this;
                event.addObJob(this.id, self);
                this._state = this._state || "inactive";
                this.state('inactive');
            })

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
   async state(state, data) {
        if (arguments.length == 0 && !this._state) {
            return this._state;
        }
        let oldState = this._state;
        this._state = state;
        let job;
        if (this._dealy) this._state = "delay";
        if (this._state === null) this._state = "inactive";
        if (oldState && oldState != this._state) {
            //change state
            if (this._state === 'failed') {
                this._toFailed(data);
            }
            if (this._state === 'complete') {
                this._toComplete();
            }
            if (this._state === 'active') {
                job =  this._toActive(this);
            }
            if (this._state === 'delay') {
                job = this._toDealy();
            }
            if (this._state === 'inactive') {
                job= this._toInactive(this);
            }
        } else {
            if (this._state === 'inactive') {
               job =  this._inactiveState(this);
            }
        }
    let update = new Promise((resolve,reject)=>{
        this.redis.client.hset(this.redis.getKey('job',this.id),'updated_at',Date.now(),function(err,effectNum){
            resolve(effectNum);
        })
    })
        await update; 
    }
    static getJob(id) {
        let worker = this;
        return new Promise((resolve, reject) => {
            let job = new Job();
            job.redis = worker.redis;
            job.id = id;
            job.redis = worker.redis;
            worker.redis.client.hgetall(worker.redis.getKey('job', id, false), (err, hash) => {
                job.type = hash.type;
                job._ttl  = hash.ttl || 0;
                job.priority = hash.priority;
                job._state = hash.state;
                job.created_at = hash.created_at;
                job.data = hash.data;
                job.updated_at = hash.updated_at;
                job.max_attempts = hash.max_attempts;
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
                //active
                if(hash.state == 'inactive'){
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
    dealy(sec) {
        if (typeof sec === 'number') {
            this._dealy = sec * 1000 + Date.now();
        } else {
            if (!isDate()) {
                throw new Error(` Date Invalid: ${sec} `)
            }
            this._dealy = new Date() + sec.getTime();
        }
        function isDate() {
            let date = new Date(sec)
                , is_date = isFinite(date.getTime()) && Date.now() < date.getTime()
            return is_date;
        }
        return this;
    }

    _toComplete() {
        let multi = this.redis.client.multi();
        let getKey = this.redis.getKey.bind(this.redis);
        let hkey = getKey('job', this.id, false)
        multi
            .hset(hkey, 'state', 'complete')
            .hset(hkey, 'updated_at', Date.now())
            .hset(hkey, 'log', data || 0)
            .hset(hkey, 'complete_at', Date.now())
            .zadd(getKey('job', this.type, 'complete'), this.priority, this.getZid())
            .zadd(getKey('jobs', this.type, 'complete'), this.priority, this.getZid())
            .exec((err) => {
                if (err)
                    throw new Error('error')
            });
    }

    _toActive(job) {
        return new Promise((resolve,reject)=>{
        let multi = this.redis.client.multi();
        let getKey = this.redis.getKey.bind(this.redis);
        let hkey = getKey('job', this.id, false)
        let zid  =this.redis.createZid(this.id)
            let ttl;
        if(this._ttl)
            ttl =+this._ttl+Date.now();
        multi
            .hset(hkey, 'state', 'active')
            .zadd(getKey('jobs', this.type, 'active'), this.priority, zid)
            .zadd(getKey('jobs', 'active'), ttl||this.priority, zid)
            .exec((err) => {
                if (err)
                  return  reject(new Error('error'))
                  return  resolve(job)
            })
        })
    }

    _toFailed(data) {
        let multi = this.redis.client.multi();
        let getKey = this.redis.getKey.bind(this.redis);
        let { err, stack } = data;
        let hkey = getKey('job', this.id, false);
        multi
            .zadd(getKey('job', this.type, 'failed'), this.priority, this.getZid())
            .zadd(getKey('jobs', 'failed'), this.priority, this.getZid())
            .hset(hkey, 'error', err)
            .hset(hkey, 'stick', stack || 0)
            .hset(hkey, 'state', 'failed')
            .hset(hkey, 'failed_at', Date.now())
            .hset(hkey, 'updated_at', Date.now())
            .set(getKey('job', this.type, 'failed','log'),err)
            .exec((err) => {
                if (err)
                    throw new Error('error')
                //notification
                event.emit.bind(this)(this.id, 'failed', this.type, { err: err, stack: stack || 0 })
            });
    }

    _toInactive(job) {
        return new Promise((resolve, reject) => {
            let multi = this.redis.client.multi();
            let getKey = this.redis.getKey.bind(this.redis);
            let zid = this.redis.createZid(this.id);
            // 有序集合不支持 smove 方法 
            multi
                .zrem(getKey('jobs:delay'), zid)
                .lpush(getKey(this.type, 'jobs'), 1)
                .zrem(getKey('jobs', this.type, 'delay'), zid)
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
                    event.emit.bind(this)(this.id, 'promotion', this.type, this.args);
                })
        })
    }
    _inactiveState(job) {
          let multi = this.redis.client.multi();
        let getKey = this.redis.getKey.bind(this.redis);
        return new Promise((resolve,reject)=>{
          multi.lpush(getKey(this.type, 'jobs', false), 1)
            .hset(getKey('job', this.id, false), 'state', this._state)
            .zadd(getKey('jobs', this._state, false), this.ttl+Date.now(), this.getZid())
            .zadd(getKey('jobs', this.type, this._state, false), this.priority, this.getZid())
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

    _toDealy() {
        let multi = this.redis.client.multi();
        let getKey = this.redis.getKey.bind(this.redis);
        multi
            .hset(getKey('job', this.id, false), 'state', this._state)
            .hset(getKey('job', this.id, false), 'delay', this._dealy)
            .zadd(getKey('jobs', this._state, false), this._dealy, this.getZid())
            .zadd(getKey('jobs', this.type, this._state, false), this.priority, this.getZid())
            .exec((err) => {
                if (err) {
                    throw new Error('error')
                }
                this.setJob('updated_at', Date.now());
                //notification
                event.emit.bind(this)(this.id, 'enqueue', this.type, this.args)
            })
    }
    args(...args) {
        this.args = Array.from(args);
        return this;
    }
}


module.exports = Job;