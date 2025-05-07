import { ArkMethod } from "../../src/core/model/ArkMethod";
import { IndexRef } from "./IndexRef";

export class TaintTransfer {
    private method : ArkMethod;
    private from : IndexRef;
    private to : IndexRef;
    constructor(method: ArkMethod, from: IndexRef, to: IndexRef) {
        this.method = method;
        this.from = from;
        this.to = to;
    }
    getMethod() : ArkMethod {
        return this.method;
    }
    getFrom() : IndexRef {
        return this.from;
    }
    getTo() : IndexRef {
        return this.to;
    }
}