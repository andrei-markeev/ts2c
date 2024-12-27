function a(){
    return function(){
        return function(){
            console.log('hello from nested func!');
        }
    };
}
a()()();