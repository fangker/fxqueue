
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
    async function a() {
   const  job1= await queue.createJob('email1',{name:'zhangsan'}).ttl(1000).delay(2000).attempts(2).save();
   console.log(job1.Json())
//   const job2 = await queue.createJob('test', { name: 'zhangsan' }).ttl(1000).delay(5000).attempts(3).save();
  // console.log(job1)
     const event =   job1.on('retry',(retry)=>{
        console.log(retry,111111)
     })
    const event1 =  job1.on('delay',(delay)=>{
        console.log(delay,2222)
    })
         
     
//    const ob= await queue.observed(1,2).on('*');
//     console.log(ob)
   }
   a()

    


let j1msg=  queue.process('email1').then((job)=>{
    console.log(job.Json());
  // job.done('121221212')
})
  queue.process('email1').then((job)=>{
    console.log(job.Json());
  // job.done('121221212')
})
  queue.process('email1').then((job)=>{
    console.log(job.Json());
  // job.done('121221212')
})
// let b=queue.createSchema('zzzz',{name:'lisi'}).ttl(2000).save()
// let m=queue.ontime('zzzz').then(a=>{
//     console.log(a,66666666666)
// });
//  const jmsg =  queue.process('test').then((job)=>{
//   // job.done('121221212')
// })