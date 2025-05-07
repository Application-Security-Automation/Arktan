import { Stmt } from "../base/Stmt";
import { PathEdge } from "./Edge";


export class ICFG {
    node: Set<Stmt> = new Set();
    edge: Set<PathEdge> = new Set();
    getOutEdges(stmt: Stmt): Set<PathEdge> {
        const edges: Set<PathEdge> = new Set();
        this.edge.forEach((e: PathEdge) => {
            if(e.srcStmt === stmt) {
                edges.add(e);
            }
        })
        return edges;
    }
    //getInEdges()
}