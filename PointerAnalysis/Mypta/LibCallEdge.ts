import { ArkMethod } from "../../Arkanalyzer/core/model/ArkMethod";
import { CallSite } from "./CallSite";
import { Edge } from "./Edge";

export class LibCallEdge implements Edge{
    private CallKind : String;
    private callsite : CallSite;
    constructor(kind: String, callsite: CallSite) {
        this.CallKind = kind;
        this.callsite = callsite;
    }
    getCallKind() {
        return this.CallKind;
    }
    getCallSite() {
        return this.callsite;
    }
}