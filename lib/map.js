
//发布的消息频道
const obMap=new Map();
//正在进行的工作
const jobsList = new Map();
//本地键事件通知分组
const subMap = new Map();


exports.addObJob=(id,msg)=>{
    obMap.set(id,msg)
}
exports.hasObJob=(id)=>{
    return obMap.has(id)
}
exports.getObJob=(id)=>{
    return obMap.get(id);
}
exports.clearObMap=()=>{
    obMap.clear();
}
//键事件通知
exports.getSubMap=(type)=>{
  return subMap.get(type);
}
exports.addSubMap=(typ,schema)=>{
   subMap.set(typ,schema)
}
exports.hasSubMap=(type)=>{
  return subMap.has(type)
}

//工作队列
exports.addInWorkMap=(id,job)=>{
    jobsList.set(id,job)
}
exports.deleteFromWorkMap=(id,job)=>{
    jobsList.set(id,job)
}
exports.clearWorkMap=(id,job)=>{
    jobsList.clear();
}
exports.hasWorkMap=(id)=>{
   return jobsList.has(id)
}
exports.getWorkMap=(id)=>{
    return jobsList.get(id)
}
