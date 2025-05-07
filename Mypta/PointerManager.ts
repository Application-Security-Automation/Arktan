import { ArkInstanceFieldRef, ArkStaticFieldRef } from "../../src/core/base/Ref";
import { ArkInvokeStmt } from "../../src/core/base/Stmt";
import { Value } from "../../src/core/base/Value";
import { FieldSignature } from "../../src/core/model/ArkSignature";
import { CallSite } from "./CallSite";
import { Obj } from "./Obj";
import { ArrayIndex, CSVar, InstanceField, StaticField } from "./Pointer";
import { TwoKeyMap } from "./TwoKeyMap";

export class PointerManager {
    private vars : Map<Value, CSVar>;
    private instancefields : TwoKeyMap<Obj, FieldSignature, InstanceField>;
    private staticfields : Map<FieldSignature, StaticField>;
    private arrayindexs : TwoKeyMap<Obj, string, ArrayIndex>;
    private callsites : Map<ArkInvokeStmt,CallSite>;
    constructor(){
        this.vars = new Map();
        this.instancefields = new TwoKeyMap();
        this.staticfields = new Map();
        this.arrayindexs = new TwoKeyMap();
        this.callsites = new Map();
    }
    getCSVar(v: Value) : CSVar {
        if(this.vars.has(v)) {
            let csvar = this.vars.get(v);
            if(csvar != undefined)
                return csvar;
        }
        let csvar = new CSVar(v);
        this.vars.set(v, csvar);
        return csvar;
    }
    getInstanceField(o: Obj, f: ArkInstanceFieldRef) : InstanceField {
        if(this.instancefields.has(o,f.getFieldSignature())) {
            let infield = this.instancefields.get(o,f.getFieldSignature());
            if(infield != undefined)
                return infield;
        }
        let infield = new InstanceField(o,f);
        this.instancefields.set(o,f.getFieldSignature(), infield);
        return infield;
    }
    getStaticField(f:ArkStaticFieldRef) : StaticField {
        if(this.staticfields.has(f.getFieldSignature())) {
            let sf = this.staticfields.get(f.getFieldSignature());
            if(sf != undefined) {
                return sf;
            }
        }
        let sf = new StaticField(f);
        this.staticfields.set(f.getFieldSignature(),sf);
        return sf;
    }
    getArrayIndex(o: Obj, i: string) : ArrayIndex{
        if(this.arrayindexs.has(o,i)) {
            let arrayindex = this.arrayindexs.get(o,i);
            if(arrayindex != undefined)
                return arrayindex;
        }
        let arrayindex = new ArrayIndex(o,i);
        this.arrayindexs.set(o,i, arrayindex);
        return arrayindex;
    }
    getCallSite(invoke: ArkInvokeStmt) : CallSite | undefined {
        if(this.callsites.has(invoke)) {
            let cs = this.callsites.get(invoke)!;
            return cs;
        }
        if(invoke.getCfg() == undefined) {
            return undefined;
        }
        let cs = new CallSite(invoke, invoke.getCfg().getDeclaringMethod());
        this.callsites.set(invoke, cs);
        return cs;
    }
}