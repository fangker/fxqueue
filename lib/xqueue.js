const EventEmitter = require('events').EventEmitter;
const Job = require('./job');
const Worker = require('./worker');
const event = require('./queueEvent');
const map= require('./map');
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
        this.lockClient=null;
        this.warlock = new Warlock(this.lockClient=redis.createLockClient());
        this.shuttingDown = false;
        this._shutDown = false;
       this.setupTimers();
    }

    createJob(type, data) {
        return new Job(type, data, this);
    }
    createSchema(type,data) {
        return  new Schema(type,data ,this.redis);
    }
    subcribeEvent() {
        event.subscribeEvent.bind(this)();
    }
    subcribeSchema() {
        event.subscribeSchema.bind(this)();
    }
    process(type) {
        let worker=this.worker =new Worker(this,type);
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
        checkSchemaTTL();

        function checkSchemaTTL() {
            self.warlock.lock('activeJobsTTL', lockTtl, function (err, unlock) {
                if (err)
                    return
                if (typeof unlock === 'function') {
                    setInterval(function () {
                        let redis = self.redis;
                        redis.client.zrangebyscore(redis.getKey('unconfirmed', 'schema'), 100000, Date.now(), 'LIMIT', 0, limit, function (err, ids) {
                            if (ids.length === 0) {
                                return;
                            }
                            ids = ids.map((zid) => { return parseInt(redis.getIDfromZid(zid)) });
                            recoverAndClear(ids);
                        })
                    }, timeout);
                }})
        }
        function recoverAndClear(ids) {
            let redis = self.redis;
            ids.forEach((id)=>{
                redis.client.hgetall(redis.getKey('schema',id),(err,schema)=>{
                    //不存在
                    let stringKey = redis.getKey('schemas', schema.type, id, JSON.stringify(schema.data));
                if(schema.state=='unconfirmed'){
                    if((parseInt(schema.schedule)+parseInt(schema.ttl)+timeout+lockTtl)<Date.now()){
                        //重新创建
                        redis.client.multi()
                            .set(stringKey,1)
                            .expire(stringKey,0)
                            .exec((err)=>{
                                if(err)
                                    throw  new Error(err);
                            })
                    }
                }else{
                    //存在且超时
                    if(schema.state=='confirmed'&&(parseInt(schema.schedule)+parseInt(schema.ttl))<Date.now()){
                        //清理
                      let multi = redis.client.multi()
                        multi
                            .del(redis.getKey('schema',id))
                            .zrem(redis.getKey('unconfirmed','schema'),redis.createZid(id) )
                            .exec((err,data)=>{
                                if(err,data)
                                    throw new Error(err)
                            })
                    }
                }
                })
            })
        }

        function doPromote(locdata) {
            let { ids, unlock } = locdata;
            ids.forEach(function (id) {
                Job.getJob.call(self, id).then((job) => {
                    event.emit.bind(job)(jobs.id, 'promoting', job.type, [{ promoted_at: Data.now() }])
                }).catch((err) => {
                    if(err)
                        throw  new Error(err)
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
                    if(err)
                    throw  new Error(err)
                    unlock();
                })
            })
        }
    }
    shutdown(ms) {
        let that =this;
        ms=+ms|0||0;
        //正在进行的任务截断返回结果
        if(this.shuttingDown){

        }else{
        this.shuttingDown=true;
        this.redis.shutDown =true;
        setTimeout(function() {
            that.worker.clear();
            this.running = false;
        }, ms);
        }
    }
    detail(){
       return {
           job_List_Count:map.jobsList.size,
           ob_List_Count:map.obList.size,
           schema_List_Count:map.subList.size,
           shutingDown:this.shuttingDown,
           shutDown:this._shutDown
       }
    }}


module.exports = Queue;