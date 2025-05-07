export class TwoKeyMap<K1,K2,V> {
    private map : Map<K1,Map<K2,V>>;
    constructor() {
        this.map = new Map();
    }
    get(k1: K1, k2: K2) : V | undefined {
        let v = this.map.get(k1)?.get(k2);
        if(v != undefined) {
            return v;
        }
        return undefined;
    }
    set(k1: K1, k2: K2, value: V) {
        if(this.map.has(k1)) {
            let m = this.map.get(k1);
            if(m != undefined)
                m.set(k2,value);
        }
        else {
            let m = new Map();
            m.set(k2,value);
            this.map.set(k1,m);
        }
        
    }
    has(k1: K1, k2: K2) : boolean {
        if(this.map.has(k1) && this.map.get(k1)?.has(k2)) {
            return true;
        }
        return false;
    }
}