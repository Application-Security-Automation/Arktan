

class A {
    id : number;
    name : string;
    constructor(id: number, name: string) {
        this.id = id;
        this.name = name;
    }
}
let map: Map<A,String> = new Map();
let a = new A(1,"zxf");
let b = new A(1,"zxf");
map.set(a,"aaa");
console.log(map.get(a));


let f : Function = f1;
f1();
function f1() {
    console.log("f1");
}    