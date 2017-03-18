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
    t.deepEqual(typeof job1.id, 'number')
    t.deepEqual(typeof job2.id, 'number')
});

test('process failed', async function (t) {
    const jmsg1 = await queue.process('test')
    t.deepEqual(typeof jmsg1, 'object')
});
test('process complete', async function (t) {
    const jmsg2 = await queue.process('email1')
    jmsg2.done('job complete');
    t.deepEqual( jmsg2.Json().data, '{"name":"zhangsan"}')
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

