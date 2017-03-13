const Job = require('./job.js');
class Handle {
    constructor(that) {
        this.redis = that.redis;
        this.type = that.type;
    }
    blpopJob() {
        let client = exports.clients[this.type] || (exports.clients[this.type] = this.redis.createClient())
        let self = this;
        return new Promise((resolve, reject) => {
            client.blpop(self.redis.getKey(this.type, 'jobs', false), 0, (err, member) => {
                console.log(err, member)
                if (err)
                    throw new Error('error')
                if (member)
                    resolve(member)
            })
        })
    }
    getjob() {
        let self = this;
        return new Promise((resolve) => {
            self.zpop(self.redis.getKey('jobs', self.type, 'inactive'))
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
    async getJob(id) {
        let jobMsg, member;
            member = await this.handle.blpopJob();
            if (member) {
                jobMsg = await this.handle.getjob();
            }
            await jobMsg.state('active');
        return jobMsg;

    }
    async start() {
        let job
        job = await this.getJob()
            return job;
    }
}
module.exports = Worker;