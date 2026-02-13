class c1 {
    constructor() {
        return {
            hello(){console.log('hello')}
        }
    }

    hello(){
        console.log('hello c1')
    }

    hi(){console.log('hi c1')}
}

const c = new c1()

console.log(c instanceof c1)
c.hello()
c.hi()