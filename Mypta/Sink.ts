import { ArkMethod } from "../../src/core/model/ArkMethod";

export class Sink {
    private method : ArkMethod;
    private index : number;
    constructor(method: ArkMethod, index: number) {
        this.method = method;
        this.index = index;
    }
    getMethod() : ArkMethod {
        return this.method;
    }
    getIndex() : number {
        return this.index;
    }
}