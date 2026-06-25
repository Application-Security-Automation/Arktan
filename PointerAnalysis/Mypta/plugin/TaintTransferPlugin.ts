import { Constant } from "../../../Arkanalyzer/core/base/Constant";
import { ArkInstanceInvokeExpr, ArkStaticInvokeExpr } from "../../../Arkanalyzer/core/base/Expr";
import { ArkAssignStmt } from "../../../Arkanalyzer/core/base/Stmt";
import { ArrayType } from "../../../Arkanalyzer/core/base/Type";
import { Value } from "../../../Arkanalyzer/core/base/Value";
import { ArkMethod } from "../../../Arkanalyzer/core/model/ArkMethod";
import { CallEdge } from "../CallEdge";
import { CallSite } from "../CallSite";
import { TaintConfig } from "../config/TaintConfig";
import { DifyWorkflowClient } from "../DifyWorkflowClient";
import { IndexRef } from "../IndexRef";
import { MyPointerAnalysis } from "../MyPointerAnalysis";
import { ArrayObj, TaintObj } from "../Obj";
import { PointerFlowEdge } from "../PointerFlowEdge";
import { TaintTransfer } from "../TaintTransfer";
import { Plugin } from "./Plugin";

export class TaintTransferPlugin implements Plugin {
    private transfers : Map<ArkMethod, TaintTransfer[]> = new Map();
    private solver! : MyPointerAnalysis;
    private IndexMap : Map<string, number> = new Map([["base",-1],["result",-2]]);
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
        if (callee != undefined) {
            if(this.transfers.has(callee)) {
                this.transfers.get(callee)?.forEach(tf => {
                    this.processTaintTransfer(tf,edge.getCallSite());
                })
            }
            else if (callee.getBody() == undefined) {
                // todo
                let methodsignature = callee.getAllSignature()[0].toString();
                methodsignature = methodsignature.split(':')[1] + ":" + methodsignature.split(':')[2]
                let difyClient: DifyWorkflowClient | null = new DifyWorkflowClient("app-KRXVPDTeeG08AHR84O579DiW");
                let response = difyClient.invokeWorkflowSync(methodsignature);
                
                if (response) {
                    console.log(response.data.outputs.text);
                    // 提取JSON数组
                    const jsonArray = this.extractJsonArray(response.data.outputs.text);
                    
                    if (jsonArray) {
                        // 处理提取的数组
                        jsonArray.forEach(item => {
                            if (item.canTransfer) {
                                // 根据from和to创建污点转移
                                // 这里可以添加创建TaintTransfer的逻辑
                                let from = this.IndexMap.get(item.from);
                                let to = this.IndexMap.get(item.to);
                                let fromindex = from != undefined ? new IndexRef(from) : new IndexRef(item.from);
                                let toindex = to != undefined ? new IndexRef(to) : new IndexRef(item.to);
                                let newtfs = new TaintTransfer(callee,fromindex,toindex);
                                this.processTaintTransfer(newtfs,edge.getCallSite());
                                let tfs = this.transfers.get(callee);
                                if(tfs != undefined) {
                                    tfs.push(newtfs);
                                    this.transfers.set(newtfs.getMethod(),tfs);
                                }
                                else {
                                    this.transfers.set(newtfs.getMethod(),[newtfs]);
                                }
                            }
                        });
                    }
                }
            }
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
    private extractJsonArray(input: string): any[] | null {
    try {
        const startIndex = input.indexOf('[');
        const endIndex = input.lastIndexOf(']');
        
        if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
            console.error("无法在字符串中找到有效的JSON数组");
            return null;
        }
        
        const jsonString = input.substring(startIndex, endIndex + 1);
        const jsonArray = JSON.parse(jsonString);
        
        return Array.isArray(jsonArray) ? jsonArray : null;
    } catch (error) {
        console.error("解析JSON时出错:", error);
        return null;
    }
}
}