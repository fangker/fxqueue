
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
   const  job1= await queue.createJob('email1',{name:'zhangsan'}).ttl(1000).delay(2000).attempts(3).save();
  // console.log(job1)
   //const event = await  job1.on('complete');
  // console.log(event,11111111111111111111)
//    const ob= await queue.observed(1,2).on('*');
//     console.log(ob)
   }
   a()

    


let j1msg=  queue.process('email1').then((job)=>{
  // job.done('121221212')
})
// let b=queue.createSchema('zzzz',{name:'lisi'}).ttl(2000).save()
// let m=queue.ontime('zzzz').then(a=>{
//     console.log(a,66666666666)
// });
