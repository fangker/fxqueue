const Job = require('./job.js');
const map = require('./map');
const event =require('./queueEvent');
class Handle {
    constructor(that) {
        this.redis = that.redis;
        this.type = that.type;
    }
    blpopJob() {
        let client = exports.clients[this.type] || (exports.clients[this.type] = this.redis.createClient())
        let self = this;
        return new Promise((resolve, reject) => {
            client.blpop(self.redis.getKey(this.type, 'jobs'), 0, (err, member) => {
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
        if(this.queue.shuttingDown===true){
              job =Promise.resolve(new Error('fxqueue will shutdown'));
        }else{
             job = await this.getJob()
        }
            return job;
    }
    clear(){
        //销毁 ob 与 work 对象map引用
        map.jobsList.forEach((job)=>{
            job.shoutdown =true;
        })
        map.clearWorkMap();
        map.clearObMap();
        map.clearSubMap();
       let key=Object.keys(exports.clients);
       for(let i of key){
           exports.clients[i].quit();
       }
       //销毁pub/sub client
       event.subClient.map((client)=>{
           client.quit();
       })
       event.pubClient.map((client)=>{
           client.quit();
       })
       //销毁 lock-clients
       this.queue.lockClient.quit();
       //销毁共用redis链接
       this.queue.redis.client.quit();
       this.queue.shoutdown= true;
    }
}
module.exports = Worker;
exports.clients = {};