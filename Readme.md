
#fxqueue

fxqueue是基于redis的nodejs优先级任务队列并对空间键事件通知进行支持。

##安装

npm install fxqueue 

##特征 
- 定时任务队列(基于redis 空间键事件通知)
- 优先级队列
- 任务事件(基于redis pub/sub)
- 延期任务
- Job TTL
- 可重试次数设定
- 可展现的任务纪录
- 队列状态概览

##未来可能支持

- Restul API支持

##概览

## 创建任务

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
let job= queue.createJob('email1',{name:'zhangsan'}).priority('high').delay(1000).save()
```
通过`.delay(sec)`来设定延迟任务，fxqueue将建立一个Timer，对X条目的delayed任务进行监控，当延迟时间达到，delayed队列任务将被取出，转换为正常任务，priority通用。

### 任务行为事件监听

####当前任务对象事件监听
```js
let job1=queue.createJob('email1',{name:'zhangsan'}).dealy(10).save()
job1.on('enqueue').then(data=>{
    console.log(data)
})
```

####队列任务事件监听
```js
queue.observed(1,2).on('*').then(data=>{
    console.log(data)
})
```
允许对redis队列事件进行监听,通过`.delay([id])`来设定监听ID,可设定多个监听ID。使用`.on(event)`设置监听对象.

如果Redis开启了key-space-event notification 选项,为了防止不必要的延迟和不断得到通知，此功能将加入 schedule 队列(被动接受) 详见 []
项目正在完善中、、、、、、、

