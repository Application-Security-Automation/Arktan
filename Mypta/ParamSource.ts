import { Type } from "../../src/core/base/Type";
import { ArkMethod } from "../../src/core/model/ArkMethod";

export class ParamSource {
    private method : ArkMethod;
    private index : number
    private type : Type;
    constructor(m : ArkMethod, t : Type, index : number) {
        this.method = m;
        this.type = t;
        this.index = index;
    }
    getMethod() : ArkMethod {
        return this.method;
    }
    getType() : Type {
        return this.type;
    }
    getIndex() : number {
        return this.index;
    }
}