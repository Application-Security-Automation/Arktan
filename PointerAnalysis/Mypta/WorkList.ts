import { Pointer } from "./Pointer";
import { PointsToSet } from "./PointsToSet";
import { CallEdge } from "./CallEdge";

export class WorkList {
    private pointerEntries: Map<Pointer, PointsToSet>;
    private callEdges: CallEdge[];
    constructor() {
        this.pointerEntries = new Map();
        this.callEdges = new Array();
    }
    addpointerEntry(pointer: Pointer, pts: PointsToSet) {
        let set: PointsToSet | undefined = this.pointerEntries.get(pointer);
        if(set != undefined) {
            set.addAll(pts);
        }
        else {
            this.pointerEntries.set(pointer,pts);
        }
    }
    addcallEdge(calledge: CallEdge) {
        this.callEdges.push(calledge);
    }
    pollEntry() :  CallEdge | pointerEntry | undefined {
        if(this.callEdges.length > 0) {
            return this.callEdges.shift();
        }
        else {
            let e = this.pointerEntries.entries().next();
            this.pointerEntries.delete(e.value[0]);
            return new pointerEntry(e.value[0], e.value[1]);
        }
    }
    isEmpty() : boolean {
        return this.callEdges.length == 0 && this.pointerEntries.size == 0;
    }
}
export class pointerEntry {
    private pointer : Pointer;
    private pts : PointsToSet;
    constructor(pointer: Pointer, pts: PointsToSet) {
        this.pointer = pointer;
        this.pts = pts;
    }
    getPointer() {
        return this.pointer;
    }
    getPts() {
        return this.pts;
    }
}