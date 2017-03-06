
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

let job1=queue.createJob('email1',{name:'zhangsan'}).save()
job1.on('enqueue',(...args)=>{
})
let j1msg=  queue.process('email1').then((job)=>{
    console.log(job)
})


