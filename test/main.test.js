const test = require('ava');
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
    async function a() {
    job1= await queue.createJob('email1',{name:'zhangsan'}).ttl(1000).delay(5000).attempts(3).save();
    job1.on('enqueue').then(data=>{
        console.log(666666666)
    })
   }
   a()

    


// let j1msg=  queue.process('email1').then((job)=>{
//    // console.log(job)
// })
let b=queue.createSchema('zzzz',{name:'lisi'}).ttl(2000).save()
let m=queue.ontime({type:'zzzz',only:true}).then(a=>{
    console.log(a)
});

test('foo', t => {
    t.pass();
});

test('bar', async t => {
    const bar = Promise.resolve('bar');
    t.is(await bar, 'b1ar');
});
test(async function (t) {
    
});