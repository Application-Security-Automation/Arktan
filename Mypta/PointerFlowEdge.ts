import { Edge } from "./Edge";
import { Pointer } from "./Pointer";

export class PointerFlowEdge implements Edge {
    private source : Pointer;
    private target : Pointer;
    constructor(source: Pointer,target : Pointer) {
        this.source = source;
        this.target = target;
    }
    Getsource() : Pointer {
        return this.source;
    }
    Gettarget() : Pointer {
        return this.target;
    }
}