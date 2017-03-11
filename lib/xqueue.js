const EventEmitter = require('events').EventEmitter;
const Job = require('./job');
const Worker = require('./worker');
const event = require('./queueEvent');
const Warlock = require('node-redis-warlock');

class Queue extends EventEmitter {
    constructor(option, redis) {
        super();
        this.id = [option.name, require('os').hostname(), process.pid].join(':');
        this.redis = redis;
        this.setMaxListeners(10);
        this.is_observedAllEvent = false;
        this.is_observedAllKey = false;
        this.subcribeEvent();
        this.running = true;
        this.warlock = new Warlock(redis.createClient());
        this.setupTimers();
    }
    async setupTimers() {
        let self = this
            , lockTtl = 2000
            , timeout = 1000
            , limit = 500;
         checkPromotion();

         function waitForAck(locdata) {
             let {ids,unlock}=locdata;
           let ack = setTimeout(function () {
                ids.forEach(function (id) {
                        Job.getJob.call(self,id).then((job)=>{
                            //this job return true
                        }).catch((err)=>{
                            console.log(err)
                            unlock()
                            clearTimeout(ack);
                        })
                })
            },1000)}



        function checkPromotion() {
                setInterval(function () {
                    self.warlock.lock('promotion', lockTtl, function (err, unlock) {
                        if (err)
                            throw new Error(err)
                        if (typeof unlock === 'function') {
                            let redis = self.redis;
                            //  [limit count offset]
                            redis.client.zrangebyscore(redis.getKey('jobs:delay'), 0, Date.now(), 'LIMIT', 0, limit, function (err, ids) {
                                if (err)
                                    reject(new Error(err))
                                if(ids.length===0){
                                    return;
                                }
                                ids = ids.map((zid) => { return parseInt(redis.getIDfromZid(zid)) });
                                waitForAck({ids,unlock});
                            })
                        }
                    })
                }, timeout)
        }
    }
    createJob(type, data) {
        return new Job(type, data, this.redis);
    }
    subcribeEvent() {
        event.subscribe.bind(this)();
    }
    process(type) {
        let worker = new Worker(this, type);
        return worker.start()
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
    on(event) {
        if (event === '*')
            this.is_observedAllEvent = true;
        return new Promise((resolve) => {
            super.on(event, function (obmsg) {
                let _arg = []
                    , _msg = null;
                if (obmsg.args !== null) {
                    obmsg.args.filter((x) => {
                        if (isNaN(x) === false || typeof x === "object") {
                            return x
                        } else {
                            _arg.push(x);
                        }
                    })
                    _msg = Object.assign(obmsg, { args: _arg });
                } else {
                    _msg = Object.assign({}, obmsg, { args: [] });
                }
                resolve(_msg);
            })
        })
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