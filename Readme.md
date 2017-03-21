
![fxqueue](http://7mnlvi.com1.z0.glb.clouddn.com/fxqueue.png?imageView/2/w/600)

# fxqueue

fxqueue是基于redis的nodejs优先级任务队列并对空间键事件通知进行支持。

## 安装

`npm install fxqueue `

## 特征 
- 定时任务队列(基于redis 空间键事件通知)
- 优先级队列
- 任务事件(基于redis pub/sub)
- 延期任务
- Job TTL
- 可重试次数设定
- 可展现的任务纪录
- 队列状态概览

## 未来可能支持

- 0-0

## 概览


## 创建队列任务

使用 `fxqueue.createQueue()`创建队列，如下

```js
var fxqueue = require('fxqueue')
  , queue = kue.createQueue({option,redis});
```

使用`queue.create()`来创建队列，这里给出一个任务demo。我们创建email1任务分组，并通过使用`priority`设置优先级(PS：默认为normal)，`.save()`将队列信息储存到Redis中。 job将返回 Promise 对象， 将返回任务ID，这时候我们可以对特殊任务进行标记。

```js 
let job= queue.createJob('email1',{name:'zhangsan'}).priority('high').save()
```
### 优先级选项

通过`.priority('high')`来设定优先级，同组任务优先级越高越先被执行。默认为normal.

```js
let job= queue.createJob('email1',{name:'zhangsan'}).priority('high').save()
```
默认对应表

```js
 {low: 10, normal: 0, medium: -5, high: -10, critical: -15}
```

### 延时任务

```js
let job= await queue.createJob('email1',{name:'zhangsan'}).priority('high').delay(1000).save()
```
通过`.delay(ms)`来设定延迟任务，fxqueue将建立一个Timer，对X条目的delayed任务进行监控，当延迟时间达到，delayed队列任务将被取出，转换为正常任务，priority通用。

### backoff
```js
let job=await queue.createJob('email1',{name:'zhangsan'}).priority('high').delay(1000).backoff({delay:2000}).save()
```
当任务失败时通过`.backoff()`设定,允许在重试时包含补偿时间，相当于进入delay状态，当`.backoff({delay:2000})`存在时,delay设定的延迟将被替代，当`.backoff(true)`时,默认使用delay作为补偿值。当`.backoff(false)`时，将无视所有补偿值，立即重试任务.

### 任务行为事件监听

#### 当前任务对象事件监听
```js
let job1=queue.createJob('email1',{name:'zhangsan'}).dealy(10).save()
job1.on('enqueue').then(data=>{
    console.log(data)
})
```

#### 队列任务事件监听
```js
//监听 ID为1和2任务的所有事件行为
queue.observed(1,2).on('*').then(data=>{
    console.log(data)
})
```

允许对redis队列事件进行监听,通过`.delay([id])`来设定监听ID,可设定多个监听ID。使用`.on(event)`设置监听对象.
```js
- `enqueue` 任务进入队列
- `active` 任务已被获取
- `promotion` 任务从delay状态过渡进入队列
- `failed` 任务失败
- `complete` 任务完成
- `retry` 任务失败并已重试
```

如果Redis开启了key-space-event notification 选项,

## 从队列获得任务
```js
let job = await queue.process('email1');
    console.log(job.Json());
    job.done('email1 complete');
})
```
通过`.process()`获得任务，通过调用`job.done(err|info)`来返回任务执行结果，当传入Error对象时，此任务将被标记为failed，传入其他参数此任务将被标记为complete。通过调用`job.Json()`可获得如下任务信息，job可返回更多细节。
```js
-`data`           任务数据
-`type`           任务分组
-`priority`       优先级
-`ttl`            任务生存时间 (从被获取到相应的最大时间)
-`state`          任务状态
-`max_attempts`   最大尝试次数
-`created_at`     任务创建时间
-`update_at`      任务修改时间
-`attempts`       已经尝试次数
-`backoff`        backoff参数细节
-`remaning`      剩余重试次数
```

## 定时任务事件
### 创建定时任务
> 请开启  redis key-event-notify 事件通知选项 

```js
    queue.createSchema('type',{data}).ttl(ttl).save()
//ex:let schema=queue.createSchema('sendMessage',{name:'lisi'}).ttl(2000).save()
```
可以通过`type`参数设定定时任务类型,通过`.ttl()`设定通知时间(ps:Date或者ms)，使用`.save()`储存任务到redis，此时将返回`<promise>`对象，可获得其ID。

### 监听定时任务
```js
queue.ontime('type');    //1
queue.ontime({type:'type',only:true});   //2
//ex:let schemajob=queue.ontime({type:'sendMessage',only:true})
```

使用`.ontime()`监听到期通知。当定时通知运行时将返回`<promise>`对象，可获得id,data。

当使用1方式时,默认消息将被广播所有调用`.ontime()`方法监听此类型的node终端，都将返回信息。

当使用2方式时，只有正在运行的此终端可以返回信息，其他终端将进入待命状态，当此终端崩溃或者销毁后，其他某个终端将会接替此终端任务，保证此定时任务通知只会触发一个终端使用。  

**注意:** 使用2方式时，不能保证在终端崩溃与下一个终端接入的时间段内触发的定时通知不会丢失。(解决方法会导致产生乱开时间段内的延迟，解决思路已出)






