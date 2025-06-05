import { Constant } from "../../../Arkanalyzer/core/base/Constant";
import { ArkInstanceInvokeExpr, ArkStaticInvokeExpr } from "../../../Arkanalyzer/core/base/Expr";
import { ArkAssignStmt } from "../../../Arkanalyzer/core/base/Stmt";
import { ArrayType } from "../../../Arkanalyzer/core/base/Type";
import { Value } from "../../../Arkanalyzer/core/base/Value";
import { ArkMethod } from "../../../Arkanalyzer/core/model/ArkMethod";
import { CallEdge } from "../CallEdge";
import { CallSite } from "../CallSite";
import { TaintConfig } from "../config/TaintConfig";
import { MyPointerAnalysis } from "../MyPointerAnalysis";
import { ArrayObj, TaintObj } from "../Obj";
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
        if(callee.getName() === "stringify"){
            callee;
        }
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
        if(fromVar.getType() instanceof ArrayType) {
            this.solver.ptrManager.getCSVar(fromVar).getObjects().forEach(o => {
                if(o instanceof TaintObj) {
                    this.solver.addPFGEdge(new PointerFlowEdge(this.solver.ptrManager.getCSVar(fromVar),this.solver.ptrManager.getCSVar(toVar)));
                }
                else {
                    let len = Number((o as ArrayObj).getNewArrayExpr().getSize() as Constant) 
                    for(let i=0; i<len; i++) {
                        this.solver.addPFGEdge(new PointerFlowEdge(this.solver.ptrManager.getArrayIndex(o,String(i)),this.solver.ptrManager.getCSVar(toVar)));
                    }
                }
                
            })
        }
        else
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