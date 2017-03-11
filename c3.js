
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
    console.log(data)
})

let job1=queue.createJob('email1',{name:'zhangs22an'}).save()
job1.on('enqueue').then(data=>{
    console.log(data)
})
// let j1msg=  queue.process('email1').then((job)=>{
//     console.log(job.data,6666666666666)
// })


