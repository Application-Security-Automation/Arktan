import { Graph } from "./Graph";
import { Pointer } from "./Pointer";
import { PointerFlowEdge } from "./PointerFlowEdge";


export class PointerFlowGraph implements Graph<Pointer> {

    addEdge(edge: PointerFlowEdge) {
        edge.Getsource().addEdge(edge);
    }
    getOutEdgesOf(pointer : Pointer) : PointerFlowEdge[] {
        return pointer.getOutEdges(pointer);
    }

}   