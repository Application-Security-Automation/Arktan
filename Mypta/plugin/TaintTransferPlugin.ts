import { ArkInstanceInvokeExpr, ArkStaticInvokeExpr } from "../../../src/core/base/Expr";
import { ArkAssignStmt } from "../../../src/core/base/Stmt";
import { Value } from "../../../src/core/base/Value";
import { ArkMethod } from "../../../src/core/model/ArkMethod";
import { CallEdge } from "../CallEdge";
import { CallSite } from "../CallSite";
import { TaintConfig } from "../config/TaintConfig";
import { MyPointerAnalysis } from "../MyPointerAnalysis";
import { PointerFlowEdge } from "../PointerFlowEdge";
import { TaintTransfer } from "../TaintTransfer";
import { Plugin } from "./Plugin";

export class TaintTransferPlugin implements Plugin {
    private transfers : Map<ArkMethod, TaintTransfer[]> = new Map();
    private solver! : MyPointerAnalysis;
    setSolver(solver: MyPointerAnalysis): void {
        this.solver = solver;
    }
    constructor(config : TaintConfig) {
        config.getTaintTransfers().forEach(transfer => {
            let tfs = this.transfers.get(transfer.getMethod());
            if(tfs != undefined) {
                tfs.push(transfer);
                this.transfers.set(transfer.getMethod(),tfs);
            }
            else {
                this.transfers.set(transfer.getMethod(),[transfer]);
            }
        })
    }
    onNewCallEdge(edge: CallEdge): void {
        let callee = edge.getCallee();
        if(this.transfers.has(callee)) {
            this.transfers.get(callee)?.forEach(tf => {
                this.processTaintTransfer(tf,edge.getCallSite());
            })
            
        }
    }
    processTaintTransfer(tf: TaintTransfer, cs: CallSite) {
        let from = tf.getFrom();
        let to = tf.getTo();
        let fromVar = this.getTransferVar(cs,from.getIndex());
        let toVar = this.getTransferVar(cs,to.getIndex());
        if(fromVar == null || toVar == null) {
            return;
        }
        this.solver.addPFGEdge(new PointerFlowEdge(this.solver.ptrManager.getCSVar(fromVar),this.solver.ptrManager.getCSVar(toVar)));
    }
    getTransferVar(cs: CallSite, index: number) : Value | null {
        let callsite = cs.getCallSite();
        let invoke = callsite.getInvokeExpr();
        if(invoke instanceof ArkStaticInvokeExpr && index === -1) {
            return null;
        }
        if(index === -1) {
            return (invoke as ArkInstanceInvokeExpr).getBase();
        }
        else if(index === -2) {
            if(callsite instanceof ArkAssignStmt) {
                return (callsite as ArkAssignStmt).getLeftOp();
            }
            return null;
        }
        else {
            return invoke.getArg(index);
        }
    }
}