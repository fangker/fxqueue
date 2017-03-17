const EventEmitter = require('events').EventEmitter;
const Job = require('./job');
const Worker = require('./worker');
const event = require('./queueEvent');
const Warlock = require('node-redis-warlock');
const Schema = require('./schema');

class Queue extends EventEmitter {
    constructor(option, redis) {
        super();
        this.id = [option.name, require('os').hostname(), process.pid].join(':');
        this.redis = redis;
        this.setMaxListeners(10);
        this.is_observedAllEvent = false;
        this.is_observedAllKey = false;
        this.subcribeEvent();
        this.subcribeSchema();
        this.running = true;
        this.warlock = new Warlock(redis.createLockClient());
      this.setupTimers();
    }

    createJob(type, data) {
        return new Job(type, data, this.redis);
    }
    createSchema(type,data) {
        return new Schema(type,data ,this.redis);
    }
    subcribeEvent() {
        event.subscribeEvent.bind(this)();
    }
    subcribeSchema() {
        event.subscribeSchema.bind(this)();
    }
    process(type) {

        let worker = new Worker(this, type);
        return worker.start();
    }
    observed(...obmsg) {
        let self = this;
        if (obmsg.length === 1 && obmsg[0] === '*') {
            this.is_observedAllKey = true;
            event.addObJob('qob-all-keys', self);
        } else {
            obmsg.map((x) => {
                event.addObJob(`qob-${x}`, self)
            })
        }


        return this;
    }
    ontime(obj){
        let _type;
        let _only=false;
        if(typeof obj =='object'&&obj!==null){
           let {type:type,only:only} =obj;
           if(only)  _only =only;
           if(type)   _type =type;
        
        }else if(obj.only==undefined||obj.only==false){
            _type = obj;
        }else{
            throw new Error('invalid parameter')
        }
        let  schema =  new Schema(_type,null,this.redis,this.warlock)
          schema.subType(_only);
          return schema.on('message');
    }
    on(event) {
        if (event === '*')
            this.is_observedAllEvent = true;
        return new Promise((resolve) => {
            super.on(event, function (obmsg) {
                resolve(obmsg);
            })
        })
    }

    async setupTimers() {
        let self = this
            , lockTtl = 2000
            , timeout = 10000
            , limit = 500;
        checkPromotion();
        checkActiveTTL();

        function doPromote(locdata) {
            let { ids, unlock } = locdata;
            ids.forEach(function (id) {
                Job.getJob.call(self, id).then((job) => {
                    event.emit.bind(job)(jobs.id, 'promoting', job.type, [{ promoted_at: Data.now() }])
                }).catch((err) => {
                    unlock()
                })
            })
        }



        function checkPromotion() {
            setInterval(function () {
                self.warlock.lock('promotion', lockTtl, function (err, unlock) {
                    if (err)
                        return
                    if (typeof unlock === 'function') {
                        let redis = self.redis;
                        //  [limit count offset]
                        redis.client.zrangebyscore(redis.getKey('jobs:delayed'), 0, Date.now(), 'LIMIT', 0, limit, function (err, ids) {
                            if (err)
                                new Error(err)
                            if (ids.length === 0) {
                                return;
                            }
                            ids = ids.map((zid) => { return parseInt(redis.getIDfromZid(zid)) });
                            doPromote({ ids, unlock });
                        })
                    }
                })
            }, timeout)
        }
        function checkActiveTTL() {
            setInterval(function () {
                self.warlock.lock('activeJobsTTL', lockTtl, function (err, unlock) {
                    if (err)
                        return
                    if (typeof unlock === 'function') {
                        let redis = self.redis;
                        //  [limit count offset]
                        redis.client.zrangebyscore(redis.getKey('jobs:active'), 100000, Date.now(), 'LIMIT', 0, limit, function (err, ids) {
                            if (err)
                                return new Error(err);
                            if (ids.length === 0) {
                                return;
                            }
                            ids = ids.map((zid) => { return parseInt(redis.getIDfromZid(zid)) });
                            removeTTLJobs({ ids, unlock });
                        })
                    }
                })
            }, timeout)
        }
        function removeTTLJobs(locdata) {
            let { ids, unlock } = locdata;
            ids.forEach(function (id) {
                Job.getJob.call(self, id).then((job) => {
                    let err = 'ttl exceed',
                        stick;
                  if(!job.complete){
                      job.state('failed', { err, stick });
                    event.emit.bind(job)(job.id, ' TTL exceed', job.type, { removeTTLJob_at: Date.now() })
                  }
                }).catch((err) => {
                    console.log(err)
                    unlock();
                })
            })
        }
    }
    shutdown() {
        //正在进行的任务截断返回结果

        //清除worker

        //清除 observe

        //销毁redis链接

        this.running = false;
    }

}

module.exports = Queue;