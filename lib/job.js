const EventEmitter = require('events').EventEmitter;
let event = require("./queueEvent.js")
const priorities = {low: 10, normal: 0, medium: -5, high: -10, critical: -15};
class Job extends EventEmitter{
    constructor(type,data,redis){
        super();
        this.type = type;
        this.data = data || {};
        this.redis = redis;
        this.priority = 0;
        this._state = null;
        this.id = null;
        this.max_attempts = 1;
        this.setMaxListeners(10);
    }
    save(){
        //get Id
        new Promise((resolve,reject)=>{
            this.redis.client.incr('ids',(err,id)=>{
            (!err)
            ?   resolve(id)
            :   reject(new Error('error'))

          })
        })
        //setIntoJob
      .then((id)=>{
            this.id=id;
            this.setJob('created_at',Date.now());
            this.setJob('priority',this.priority);
            this.setJob('max_attempts',this.max_attempts);
            this.setJob('data',this.data);
            this.setJob('type',this.type);
            this.addTypes();
            this.addIntoJobs();
            return;
        })
        //set state and refresh it
       .then(()=>{
            //add to jobList
           let self = this;
           event.addJobList(this.id,self);
            this._state=this._state||"inactive";
            //do something
            //add to Job Map

            this.state('inactive');
       })
        
        return this;
    }
    priority(level){
        this.priority = priorities[level];
        if(this.id){
            this.setJob('priority',this.priority)
            this.setJob('update_at',this.priority)
        }
        return this;
    }
    setJob(key,value){
         this.redis.client.hset(this.redis.getKey('job',true)+this.id,key,JSON.stringify(value));
    }
    addTypes(){
        this.redis.client.sadd(this.redis.getKey('job',true)+'types',this.type)
    }
    addIntoJobs(){
        this.redis.client.zadd(this.redis.getKey('jobs',false),this.priority,this.getZid())
    }
    getZid(){
        return this.redis.createZid(this.id);
    }
    state(state,data){
         if(arguments.length == 0 && !this._state){
             return this._state;
         }
         let getKey=this.redis.getKey.bind(this.redis);
         let oldState = this._state;
         let multi = this.redis.client.multi();
         if(oldState && oldState != state){
             //change state
             if(state ==='failed'){
                 let{err,stack}=data;
                 multi
                    .zadd(getKey('job',this.type,'failed'),this.priority,this.getZid())
                    .zadd(getKey('jobs','failed'),this.priority,this.getZid())
                    .hset(getKey('job',this.id),'error',err,'stick',stack||0,'state','failed','failed_at',Date.now(),'updated_at',Data.now())
                    .exec((err)=>{
                        throw new Error('error')
                    });
             }
             if(state ==='complete'){
                     multi
                        .hset(getKey('job',this.id),'state','complete','updated_at',Data.now(),'complete_at',Data.now())
                        .zadd(getKey('job',this.type,'complete'),this.priority,this.getZid())
                        .zadd(getKey('jobs',this.type,'complete'),this.priority,this.getZid())
                        .exec((err)=>{
                        throw new Error('error')
                        });
             }
             if(state ==='active'){
                 multi
                    .hset(getKey('job',this.id),'state','active','updated_at',Data.now())
                    .exec((err)=>{
                        throw new Error('error')
                    });
             }

         }else{
             console.log(getKey('jobs', this._state,false))
             multi
                .hset(getKey('job',this.id,false), 'state', this._state)
                .zadd(getKey('jobs', this._state,false), this.priority, this.getZid())
                .zadd(getKey('jobs', this.type,this._state,false), this.priority,this.getZid());
                if(state==='inactive'){
                   multi.lpush(getKey(this.type,'jobs',false),1);
                }
                this.setJob('updated_at', Date.now());
                this._state=state;
                multi.exec(()=>{
                    //notification
                     event.emit.bind(this)(this.id,'enqueue',this.type)
                })
         }
    }
    static getJob(id){
       let worker=this;
       status('active',null);
       return new Promise((resolve,reject)=>{
         let job = new Job();
         job.redis  = worker.redis;
        worker.redis.client.hgetall(worker.redis.getKey('job:' + id),(err,hash)=>{
          job.type           = hash.type;
          job.priority       = hash.priority;
          job._state         = hash.state;
          job.created_at     = hash.created_at;
          job.data           = hash.data;
          job.updated_at     = hash.updated_at;
          job.max_attempts   = hash.max_attempts;
          job.id             = hash.id;
          resolve(job); 
        })
       })
       
        
        
    }
    update(){
        
    }
    done(msg){
         let getKey=this.redis.getKey.bind(this.redis);
         let multi = this.redis.client.multi();
        if(msg instanceof Error){
            let err = msg.message;
            let stack =  msg.stack;
            state('failed',{err,stack}); 
        }
    }


}


module.exports=Job;