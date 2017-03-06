const EventEmitter = require('events').EventEmitter;
const Job = require('./job');
const Worker = require('./worker');
const workerList = require('./map')

const event = require('./queueEvent.js');
class Queue extends EventEmitter{
    constructor(option,redis) {
        super();
        this.id = [option.name,require('os').hostname(),process.pid].join(':');
        this.redis = redis;
        this.subcribeEvent();
    }
    createJob(type,data){
        return new Job(type,data,this.redis);
    }
    subcribeEvent(){
        event.subscribe.bind(this)();
    }
    process(type){
        let worker = new Worker(this,type);
            return  worker.start()
    }

}

module.exports = Queue;