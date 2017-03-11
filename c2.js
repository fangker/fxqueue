   function args(...args){
        this.args=Array.from(args);
       return this.args
    }
    var a=args('sdsds');
    console.log(a)