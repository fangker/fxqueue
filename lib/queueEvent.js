
const jobsMap = require('./map.js');




exports.subscribeEvent = function () {

        //设置订阅频道
        let    redis = this.redis;
        let sub = redis.createClient();
        sub.on("message", exports.queueMessage)
        sub.subscribe(redis.getKey('events'), function (err, channel) {
            //订阅频道名称
            console.log(err, channel, '已经订阅')
        });
        return;

}
exports.subscribeSchema =function(){
    let    redis = this.redis;
        exports.redisConfig=redis.redisConfig;
        let sub = redis.createClient();
        sub.on("pmessage", exports.schemaMessage)
        sub.psubscribe(`__keyevent@${redis.redisConfig.db}__:expired`, function (err, channel) {
            //订阅频道名称
            console.log(err, channel, '已经订阅')
        });
        return;
}

exports.schemaMessage=function( matchedChannel, channel,msg){
   let separator= exports.redisConfig.separator;
   // msg->  q:schema:email1:12:{"name":"lisi"}
   let data =msg;
   for(let i=0;i<=3;i++){
        data=data.substr(data.indexOf(separator)+1);
   }
   let  _msg=msg.split(separator);
    _msg=_msg.slice(0,3)
    _msg.push(JSON.parse(data));
   if(jobsMap.hasSubMap(_msg[2])){
        jobsMap.getSubMap(_msg[2]).emit('message',_msg)
   }
}

exports.emit = function (id, event, type, ...args) {
    redis = this.redis;
   let obmsg={ id: id, event: event, type: type};
    let _arg = []
        , _msg = null
    if (args !== []) {
     args= args.filter((x) => {
            if (isNaN(x) === false || typeof x === "object") {
               _msg = Object.assign(obmsg,x);
               return
            } else {
                return x;
            }
        })
        _msg = Object.assign(obmsg, { args: args });
    } else {
        _msg = Object.assign({}, obmsg, { args: [] });
    }
    obmsg=JSON.stringify(_msg);
    redis.client.publish(redis.getKey('events', false), obmsg, function (err, num) {
        console.log(err, num, '发布:',obmsg)
    });
};

exports.queueMessage = function (channel, msg) {
    let message = JSON.parse(msg);
    let id = message.id;
    let job = null;
    let event = null;
    if (message.hasOwnProperty('event')) {
        event = message.event;
        if (jobsMap.hasObJob(id) == true) {
            //移除错误和已完成任务
            job = jobsMap.getObJob(id);
            job.emit(event, message);
        }
        // Qobserved 监听
        if (jobsMap.hasObJob(`qob-${id}`) === true) {
            qJob = jobsMap.getObJob(`qob-${id}`);
            if (qJob.is_observedAllEvent === true)
                return qJob.emit('*', message)
            qJob.emit(event, message);
        } else if (jobsMap.hasObJob(`qob-all-keys`) === true) {
            qJob = jobsMap.getObJob(`qob-all-keys`);
            if (qJob.is_observedAllKey === true)
                return qJob.emit('*', message)
            qJob.emit(event, message);
        }

    }
}

function hasObJob(msg) {
    return jobsMap.hasObJob(msg.id, msg)
}
function addInWorkMap(id, job) {
    jobsMap.addInWorkMap(id, job)
}
exports.addObJob = (id, job) => {
    jobsMap.addObJob(id, job)
}
exports.getObJob = (id, job) => {
    jobsMap.getObJob(id)
}
exports.addSubMap=(type,schema)=>{
    jobsMap.addSubMap(type,schema);
}
exports.hasSubMap=(type,schema)=>{
   return jobsMap.hasSubMap(type,schema);
}