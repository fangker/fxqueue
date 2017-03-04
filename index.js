const Queue = require('./lib/xqueue.js');
const RedisFactory = require('./lib/redis')

module.exports={
     createQueue:function ({options,redis}) {
         let RedisClient= new RedisFactory(options,redis);
         return new Queue(options,RedisClient);
     }
}