const Job = require('./job.js');
class Handle {
    constructor(that) {
        this.redis = that.redis;
        this.type = that.type;
    }
    blpopJob() {
        let self = this;
        return new Promise((resolve, reject) => {
            let client = exports.clients[this.type] || (exports.clients[this.type] = this.redis.createClient())
            client.blpop(self.redis.getKey(this.type, 'jobs', false), 0, (err, data) => {
                if (err)
                    throw new Error('error')
                if (!data) {
                    reject(null);
                } else {
                    resolve(data);
                }
            })
        })
    }
    getDelayJob() {
        let self = this;
        return new Promise((resolve) => {
            self.zpop(self.redis.getKey('jobs', self.type, 'delay'))
                .then((zid) => {
                    let id = self.redis.getIDfromZid(zid);
                    //添加到worker    
                    let workJob = Job.getJob.call(self, id);
                    workJob.then((data) => {
                        resolve(data)
                    })
                })
        })
    }
    getjob() {
        let self = this;
        return new Promise((resolve) => {
            self.zpop(self.redis.getKey('jobs', self.type, 'delay'))
                .then((zid) => {
                    let id = self.redis.getIDfromZid(zid);
                    //添加到worker    
                    let workJob = Job.getJob.call(self, id);
                    workJob.then((data) => {
                        resolve(data)
                    })
                })
        })
    }
    isDelay() {
        let self = this;
        let skey = self.redis.getKey('jobs', self.type, 'delay')
        return new Promise((resolve, reject) => {
            self.redis.client.zrange(skey, 0, 0, function (err, member) {
                if (!err) {
                    self.redis.client.zscore(skey, member, (err, score) => {
                        console.log(parseInt(score))
                        if (parseInt(Date.now() - score) > 0) {
                            resolve(true);
                        }
                    })
                }else{
                reject(err);
                }
            })
        })

    }
    //集合原子出栈方法
    zpop(key) {
        return new Promise((resolve, reject) => {
            let multi = this.redis.client.multi();
            multi
                .zrange(key, 0, 0)
                .zremrangebyrank(key, 0, 0)
                .exec(function (err, data) {
                    (err) ? reject(err) : resolve(data[0][0])
                })
        })
    }


}

exports.clients = {};
class Worker {
    constructor(queue, type) {
        this.queue = queue;
        this.type = type;
        this.redis = queue.redis;
        this.runing = true;
        this.handle = new Handle(this);
    }
    async getJob() {
        let jobMsg;
        let jobId = await this.handle.blpopJob();
        if (jobId)
            var isdelay = await this.handle.isDelay();
        if (isdelay)
            jobMsg = await this.handle.getDelayJob();
        jobMsg = await this.handle.getjob();
        return jobMsg;

    }
    start() {
        let job
        try {
            job = this.getJob()
        } catch (e) {
            let that = this;
            return new Promise((resolve) => {
                process.nextTick(() => {
                    resolve(that.getJob());
                })
            })
        }
        return job;
    }

}
module.exports = Worker;