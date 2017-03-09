
const jobsMap = require('./map.js');
let key = 'events';
let isSubscribe = false;
let redis = null;


exports.subscribe = function () {
    if (isSubscribe) {
        return;
    } else {
        //设置订阅频道
        redis = this.redis;
        let sub = redis.createClient();
        sub.on("message", exports.message)
        sub.subscribe(redis.getKey('events'),function(err,channel){
            //订阅频道名称
            console.log(err,channel,'已经订阅')
        });
        return;
    }

}

exports.emit = function( id, event,type ,args) {
    redis=this.redis;
    let msg = JSON.stringify({
        id: id, event: event, type:type,args: [].slice.call(arguments, 3)
      });
    redis.client.publish(redis.getKey(key,false), msg, function (err,num) {
        console.log(err,num,'发布')
    });
};

exports.message = function (channel, msg) {
    let message = JSON.parse(msg);
    let id= message.id;
    let job=null;
    let event=null;
        if( message.hasOwnProperty('event'))  {
            event= message.event;
            exports.addJobs( message);
            if(jobsMap.JobListHas(id)==true){
                if(['failure','complite']){
                    //移除元素
                }
                job=jobsMap.getJobList(id);
                job.emit(event, message);
            }
        }

}

exports.addJobs=(msg)=>{
    jobsMap.addInJobs(msg.id,msg)
}
exports.addJobList=(id,job)=>{
    jobsMap.addInJobList(id,job)
}