
const jobsMap=new Map();
const jobsList = new Map();
const workerList =new  Set();


exports.addInJobs=(id,msg)=>{
    jobsMap.set(id,msg)
}

exports.deleteJob=(id)=>{
    jobsMap.delete(id)
}

exports.JobHas=(id)=>{
    return jobsMap.has(id)
}

exports.clear=()=>{
    jobsMap.clear();
}



exports.addInJobList=(id,job)=>{
    jobsList.set(id,job)
}
exports.deleteJobFromList=(id,job)=>{
    jobsList.set(id,job)
}
exports.clearJobList=(id,job)=>{
    jobsList.clear();
}
exports.JobListHas=(id)=>{
   return jobsList.has(id)
}
exports.getJobList=(id)=>{
    return jobsList.get(id)
}