import { Type } from "../../src/core/base/Type";
import { ArkMethod } from "../../src/core/model/ArkMethod";

export class CallSource {
    private method : ArkMethod;
    private type : Type;
    constructor(m : ArkMethod, t : Type) {
        this.method = m;
        this.type = t;
    }
    getMethod() : ArkMethod {
        return this.method;
    }
    getType() : Type {
        return this.type;
    }
}