let a= new Promise((resolve)=>{
console.log(11111111111);
return resolve(1)
console.log(222222222)
})
a.then((b)=>{
    console.log(b)
})