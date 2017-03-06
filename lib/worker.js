const Job = require('./job.js');

exports.clients = {};
class Worker {
    constructor(queue, type) {
        this.queue = queue;
        this.type = type;
        this.redis = queue.redis;
        this.runing = true;
    }
    getJob() {
        let self = this;
        return new Promise((resolve) => {
            let client = exports.clients[this.type] || (exports.clients[this.type] = this.redis.createClient())
            client.blpop(self.redis.getKey(this.type, 'jobs', false), 0, (err, data) => {
                if (err)
                    throw new Error('error')
                if (!data)
                    resolve(null)
            })
            //出栈
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
    async start() {
        let job = await this.getJob()
        let that = this;
            if (!job.id) {
             return new Promise((resolve)=>{
                 process.nextTick(()=>{
                 resolve(that.getJob());
               })
             }) 
            }
        return this.getJob()

    }
}
module.exports = Worker;