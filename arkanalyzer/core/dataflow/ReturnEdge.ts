import { Stmt } from "../base/Stmt";
import { PathEdge } from "./Edge";



export class ReturnEdeg extends PathEdge {
    public callstmt: Stmt;

    constructor(start:Stmt, end:Stmt, kind: number, call: Stmt) {
        super(start,end,kind);
        this.callstmt = call;
    }
    getCallsite(): Stmt {
        return this.callstmt;
    }
}