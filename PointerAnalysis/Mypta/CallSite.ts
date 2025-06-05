import { ArkInvokeStmt } from "../../Arkanalyzer/core/base/Stmt";
import { ArkMethod } from "../../Arkanalyzer/core/model/ArkMethod";

export class CallSite {
    private callsite : ArkInvokeStmt;
    private caller : ArkMethod | null;
    constructor(cs: ArkInvokeStmt, caller: ArkMethod | null) {
        this.callsite = cs;
        this.caller = caller;
    }
    getCallSite() : ArkInvokeStmt {
        return this.callsite;
    }
    getCaller() : ArkMethod | null {
        return this.caller;
    }
}