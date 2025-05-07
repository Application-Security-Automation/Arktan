import { ArkMethod } from "../../src/core/model/ArkMethod";
import { CallSite } from "./CallSite";
import { Edge } from "./Edge";

export class CallEdge implements Edge{
    private CallKind : String;
    private callsite : CallSite;
    private callee : ArkMethod;
    constructor(kind: String, callsite: CallSite, callee: ArkMethod) {
        this.CallKind = kind;
        this.callsite = callsite;
        this.callee = callee;
    }
    getCallKind() {
        return this.CallKind;
    }
    getCallSite() {
        return this.callsite;
    }
    getCallee() {
        return this.callee;
    }
}