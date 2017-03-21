
//发布的消息频道
const obList=new Map();
//正在进行的工作
const jobsList = new Map();
//本地键事件通知
const subList = new Map();

exports.jobsList=jobsList;
exports.obList=obList;
exports.subList =subList;

exports.addObJob=(id,msg)=>{
    obList.set(id,msg)
}
exports.hasObJob=(id)=>{
    return obList.has(id)
}
exports.getObJob=(id)=>{
    return obList.get(id);
}
exports.clearObMap=()=>{
    obList.clear();
}
exports.deleteFromObMap=(id)=>{
    obList.delete(id);
}

//键事件通知
exports.getSubMap=(type)=>{
  return subList.get(type);
}
exports.addSubMap=(typ,schema)=>{
    subList.set(typ,schema)
}
exports.hasSubMap=(type)=>{
  return subList.has(type)
}
exports.clearSubMap=(type)=>{
  return subList.clear()
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
