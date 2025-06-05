import { ArkInstanceFieldRef, ArkStaticFieldRef } from "../../Arkanalyzer/core/base/Ref";
import { Type } from "../../Arkanalyzer/core/base/Type";
import { Value } from "../../Arkanalyzer/core/base/Value";
import { Obj } from "./Obj";
import { PointerFlowEdge } from "./PointerFlowEdge";
import { PointsToSet } from "./PointsToSet";

export abstract class Pointer {
    private pointsToSet?: PointsToSet;
    private successors : Set<Pointer>;
    private outedges : PointerFlowEdge[];
    constructor() {
        this.successors = new Set<Pointer>;
        this.outedges = new Array();
    }
    public getPointsToSet(): PointsToSet | undefined {
        return this.pointsToSet;
    }

    public setPointsToSet(pts: PointsToSet) {
        this.pointsToSet = pts;
    }

    public getObjects(): Set<Obj> {
        let pts = this.getPointsToSet();
        if(pts != undefined)
            return pts.getObjects();
        return new Set();
    }
    addEdge(edge: PointerFlowEdge) {
        this.successors.add(edge.Gettarget());
        this.outedges.push(edge);
    }
    getOutEdges(pointer : Pointer) : PointerFlowEdge[] {
        return this.outedges;
    }
}

export class CSVar extends Pointer {
    var : Value;
    //context : Context;
    constructor(v: Value) {
        super();
        this.var = v;
    }
    public getVar() : Value {
        return this.var;
    }
    public getType() : Type {
        return this.var.getType();
    }
}

export class InstanceField extends Pointer {
    field : ArkInstanceFieldRef;
    obj : Obj;
    constructor(o: Obj, f: ArkInstanceFieldRef){
        super();
        this.field = f;
        this.obj = o;
    }
    public getField() : ArkInstanceFieldRef {
        return this.field;
    }
    public getObj() : Obj {
        return this.obj;
    }
}

export class ArrayIndex extends Pointer {
    obj : Obj;
    index : string;
    constructor(o: Obj, i: string){
        super();
        this.obj = o;
        this.index = i;
    }
    public getObj() : Obj {
        return this.obj;
    }
    public getIndex() : string {
        return this.index;
    }
}

export class StaticField extends Pointer {
    field : ArkStaticFieldRef;
    constructor(f: ArkStaticFieldRef){
        super();
        this.field = f;
    }
    public getField() : ArkStaticFieldRef {
        return this.field;
    }
}