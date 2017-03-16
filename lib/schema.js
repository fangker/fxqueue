const event =require('./queueEvent');
const EventEmitter = require('events').EventEmitter;
class schema extends EventEmitter {
    constructor(type, data,redis,warlock) {
        super();
        this._ttl = null;
        this.redis = redis;
        this.id =null;
        this.type = type;
        this.data = data;
        this.only=false;
        this.warlock=warlock;

    }
     on(event){
         return new Promise((resolve)=>{
            super.on(event,function(msg){
                    resolve(msg)
             })
         })
    }
   async save() {
        let multi = this.redis.client.multi();
    let id = await  new Promise((resolve) => {
            this.redis.client.incr('ids', (err, id) => {
                (!err)
                    ? resolve(id)
                    : reject(new Error('error'))
            })
        })
        this.id =id;
        let stringKey =this.redis.getKey('schema', this.type,id,JSON.stringify(this.data));
            multi
                .zadd(this.redis.getKey('schema', this.type), parseInt(this._ttl)+ Date.now(),this.redis.createZid(id))
                .zadd('schemas', parseInt(this._ttl) + Date.now(),this.redis.createZid(id))
                .set(stringKey,1)
                .expire(stringKey,Math.round(this._ttl/1000))
                .exec((err) => {
                    if (err)
                        throw new Error(err)
              })
        return this;
    }
    ttl(ttl) {
        let _ttl = + ttl | 0 || 0;
        this._ttl = _ttl;
        return this;
    }
    subType(only){
        if(only){
          this.only=true;
          this.lockType();
        }else{
            event.addSubMap(this.type,this);
        }
    return this;
}
    lockType(){
         let self = this
            , lockTtl = 20000
            , timeout = 1000
        setImmediate(function(){
             self.warlock.lock(`schema${self.type}`, lockTtl, function (err, unlock) {
                 if(err) return;
                if (typeof unlock === 'function'){
                        //可以监听，增加到监听列表
                        if(event.hasSubMap(self.type)===false)
                            {
                                event.addSubMap(self.type,self)
                            }else{
                                return;
                            }
                }
             })

        },1000)
    }
}

module.exports = schema;