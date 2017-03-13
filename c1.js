
const xqueue= require('./index.js');
let queue=xqueue.createQueue({
    options:{
        prefix:'q',
      //  separator:'=>',
        name:'xqueue'
    },
    redis:{
        port: 6379,
        host: 'localhost',
        auth: '',
        db: 3,
        options: {
        }
    }
})
queue.observed(1,2).on('*').then(data=>{
    
})

let job1=queue.createJob('email1',{name:'zhangsan'}).ttl(1000).save()
job1.on('enqueue').then(data=>{
    console.log(data,666666666)
})
let j1msg=  queue.process('email1').then((job)=>{
    console.log(job)
})
