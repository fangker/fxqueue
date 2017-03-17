const test = require('ava');
const xqueue = require('../index.js');
let queue = xqueue.createQueue({
    options: {
        prefix: 'q',
        name: 'xqueue'
    },
    redis: {
        port: 6379,
        host: 'localhost',
        auth: '',
        db: 3,
        options: {
        }
    }
})

 test('queueEvent', t => {
     return queue.observed(1, 2).on('*').then(data => {
         t.deepEqual(typeof data, 'object')
     })
 });
test('createJobAndJobevent', async function (t) {
    const job1 = await queue.createJob('email1', { name: 'zhangsan' }).ttl(1000).delay(5000).attempts(3).save();
    const job2 = await queue.createJob('test', { name: 'zhangsan' }).ttl(1000).delay(5000).attempts(3).save();
    t.deepEqual(typeof job1, 'object');
    const event_enqueue = await job1.on('enqueue');
    t.deepEqual(typeof event_enqueue, 'object')
    const event_active= await job1.on('active');
    t.deepEqual(typeof event_active, 'object')
    const event_failed = await job2.on('failed');
    t.deepEqual(typeof event_failed, 'object')
    const event_retry = await job2.on('retry');
    t.deepEqual(typeof event_retry, 'object')
    const event_promotion = await job1.on('promotion');
    t.deepEqual(typeof event_promotion, 'object')

});

test('process failed', async function (t) {
    const jmsg = await queue.process('test')
    t.deepEqual(typeof jmsg, 'object')
});
test('process complete', async function (t) {
    const jmsg2 = await queue.process('email1')
    jmsg2.done('job complete');
    t.deepEqual(typeof jmsg2, 'object')
});



test('createSchema', async function (t) {
    const getschemaid1 = await queue.createSchema('zzzz', { name: 'lisi' }).ttl(2000).save()
    t.deepEqual(typeof getschemaid1, 'number');
    const getschemaid2 = await queue.createSchema('qqqq', { name: 'zhanglei' }).ttl(2000).save()
    t.deepEqual(typeof getschemaid2, 'number');
});

test('getSchema', async function (t) {
    const getschema1 = await queue.ontime({ type:'zzzz'});
    t.deepEqual(typeof getschema1, 'object');
});
test('getSchemaOnly', async function (t) {
    let getschema2 = await queue.ontime({ type: 'qqqq', only: true })
    t.deepEqual(typeof getschema2, 'object');
});

