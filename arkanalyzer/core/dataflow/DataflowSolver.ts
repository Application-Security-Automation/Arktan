/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Scene } from '../../Scene';
import { AbstractInvokeExpr } from '../base/Expr';
import {  ArkInvokeStmt, ArkReturnStmt, ArkReturnVoidStmt, Stmt } from '../base/Stmt';
import { ArkMethod } from '../model/ArkMethod';
import { DataflowProblem } from './DataflowProblem';
import { PathEdge } from './Edge';
import { BasicBlock } from '../graph/BasicBlock';
import { CallGraph } from '../../callgraph/model/CallGraph';
import { ClassHierarchyAnalysis } from '../../callgraph/algorithm/ClassHierarchyAnalysis';
import { addCfg2Stmt } from '../../utils/entryMethodUtils';
import { getRecallMethodInParam } from './Util';
import { DataflowResult } from './DataflowResult';
import { Value } from '../base/Value';
import { Fact } from './Fact';
import { ICFG } from './ICFG';
import { ReturnEdeg } from './ReturnEdge';
/*
this program is roughly an implementation of the paper: Practical Extensions to the IFDS Algorithm.
compare to the original ifds paper : Precise Interprocedural Dataflow Analysis via Graph Reachability,
it have several improvments:
1. construct supergraph on demand(implement in this program);
2. use endSummary and incoming tables to speed up the program(implement in this program)
3. handle ssa form(not implement)
4. handle data facts which subsume another(not implement)
*/
type CallToReturnCacheEdge<D> = PathEdge;

export abstract class DataflowSolver<D> {

    protected problem: DataflowProblem<D>;
    protected workList: Array<PathEdge>;
    protected pathEdgeSet: Set<PathEdge>;
    protected zeroFact: Value;
    // protected inComing: Map<PathEdgePoint<D>, Set<PathEdgePoint<D>>>;
    // protected endSummary: Map<PathEdgePoint<D>, Set<PathEdgePoint<D>>>;
    protected summaryEdge: Set<CallToReturnCacheEdge<D>>; // summaryEdge不是加速一个函数内多次调用同一个函数，而是加速多次调用同一个函数f时，f内的函数调用
    protected scene: Scene;
    protected CHA!: ClassHierarchyAnalysis;
    protected stmtNexts: Map<Stmt, Set<Stmt>>;
    //protected laterEdges: Set<PathEdge<D>> = new Set();
    protected returntoCall: Map<Stmt, Stmt>; //add
    protected stmttoFact: Map<Stmt, Set<D>>; //add
    protected result: DataflowResult;
    protected icfg: ICFG;

    constructor(problem: DataflowProblem<D>, scene: Scene) {
        this.problem = problem;
        this.scene = scene;
        scene.inferTypes();
        this.zeroFact = problem.createZeroValue();
        this.workList = new Array<PathEdge>();
        this.pathEdgeSet = new Set<PathEdge>();
        // this.inComing = new Map<PathEdgePoint<D>, Set<PathEdgePoint<D>>>();
        // this.endSummary = new Map<PathEdgePoint<D>, Set<PathEdgePoint<D>>>();
        this.summaryEdge = new Set<CallToReturnCacheEdge<D>>();
        this.stmtNexts = new Map();
        this.returntoCall = new Map<Stmt, Stmt>(); //add
        this.stmttoFact = new Map<Stmt, Set<D>>(); //add
        this.result = new DataflowResult();
        this.icfg = new ICFG();
    }

    public solve() {
        this.init();
        this.doSolve();
    }

    // protected computeResult(stmt: Stmt, d: D): boolean {
    //     for (let pathEdge of this.pathEdgeSet) {
    //         if (pathEdge.edgeEnd.node === stmt && pathEdge.edgeEnd.fact === d) {
    //             return true;
    //         }
    //     }
    //     return false;
    // }

    protected getChildren(stmt: Stmt): Stmt[] {
        return Array.from(this.stmtNexts.get(stmt) || []);
    }

    protected init() {

        // build CHA
        let cg = new CallGraph(this.scene)
        this.CHA = new ClassHierarchyAnalysis(this.scene, cg)
        this.buildStmtMapInClass();
        this.setCfg4AllStmt();

        //初始化方式变更
        let srcStmt = this.problem.getEntryPoint();
        this.buildICFG(srcStmt);
        let ZeroFact: Set<Value> = new Set<Value>([this.zeroFact]);
        this.result.stmt2InFacts.set(srcStmt, new Fact(ZeroFact));
        this.result.stmt2OutFacts.set(srcStmt, new Fact(ZeroFact));
        this.icfg.getOutEdges(srcStmt).forEach((edge: PathEdge) => {
            this.workList.push(edge);
        })
        return;
    }
    protected buildICFG(entry: Stmt) {
        let handlestmt: Array<Stmt> = new Array(entry);
        while(handlestmt.length != 0) {
            let stmt = handlestmt.shift()!;
            this.icfg.node.add(stmt);
            if (this.isCallStatement(stmt)) {
                const invokeStmt = stmt as ArkInvokeStmt;
                let callees: Set<ArkMethod>;
                if (this.scene.getFile(invokeStmt.getInvokeExpr().getMethodSignature().getDeclaringClassSignature().getDeclaringFileSignature())) {
                    callees = this.getAllCalleeMethods(invokeStmt);
                } else {
                    callees = new Set([getRecallMethodInParam(invokeStmt)!]);
                }
                let returnSite: Stmt = this.getReturnSiteOfCall(stmt);
                for (let callee of callees) {
                    if (!callee.getCfg()) {
                        continue;
                    }
                    let firstStmt: Stmt = [...callee.getCfg()!.getBlocks()][0].getStmts()[callee.getParameters().length];
                    let returindex = [...callee.getCfg()!.getBlocks()][0].getStmts().length - 1; //add
                    let returnStmt: Stmt = [...callee.getCfg()!.getBlocks()][0].getStmts()[returindex]; //add
                    const calledge: PathEdge = new PathEdge(stmt, firstStmt, 1);
                    this.icfg.edge.add(calledge);
                    const returnedge: ReturnEdeg = new ReturnEdeg(returnStmt, returnSite, 2, stmt);
                    this.icfg.edge.add(returnedge);
                    handlestmt.push(firstStmt);
                }
            }
            let stmts: Stmt[] = [...this.getChildren(stmt)].reverse();
            for (let s of stmts) {
                handlestmt.push(s);
                let edgeKind: number = 0; //noraml边
                if (this.isCallStatement(stmt)) {
                    edgeKind = 3; //calltoreturn边
                }
                const edge: PathEdge = new PathEdge(stmt, s, edgeKind);
                this.icfg.edge.add(edge);
            }
        }
        

    }
    protected buildStmtMapInClass() {
        const methods = this.scene.getMethods(true);
        methods.push(this.problem.getEntryMethod());
        for (const method of methods) {
            const cfg = method.getCfg();
            const blocks: BasicBlock[] = [];
            if (cfg) {
                blocks.push(...cfg.getBlocks());
            }
            for (const block of blocks) {
                this.buildStmtMapInBlock(block);
            }
        }
    }
    protected buildStmtMapInBlock(block: BasicBlock): void {
        const stmts = block.getStmts();
        for (let stmtIndex = 0; stmtIndex < stmts.length; stmtIndex++) {
            const stmt = stmts[stmtIndex];
            if (stmtIndex !== stmts.length - 1) {
                this.stmtNexts.set(stmt, new Set([stmts[stmtIndex + 1]]));
            } else {
                const set: Set<Stmt> = new Set();
                for (const successor of block.getSuccessors()) {
                    set.add(successor.getStmts()[0]);
                }
                this.stmtNexts.set(stmt, set);
            }
        }
    }

    protected setCfg4AllStmt() {
        for (const cls of this.scene.getClasses()) {
            for (const mtd of cls.getMethods(true)) {
                addCfg2Stmt(mtd);
            }
        }
    }

    protected getAllCalleeMethods(callNode: ArkInvokeStmt): Set<ArkMethod> {
        const callSites = this.CHA.resolveCall(
            this.CHA.getCallGraph().getCallGraphNodeByMethod(this.problem.getEntryMethod().getSignature()).getID(), callNode);
        const methods: Set<ArkMethod> = new Set();
        for (const callSite of callSites) {
            const method = this.scene.getMethod(this.CHA.getCallGraph().getMethodByFuncID(callSite.calleeFuncID)!);
            if (method) {
                methods.add(method);
            }
        }
        return methods;
    }

    protected getReturnSiteOfCall(call: Stmt): Stmt {
        return [...this.stmtNexts.get(call)!][0];
    }

    protected getStartOfCallerMethod(call: Stmt): Stmt {
        const cfg = call.getCfg()!;
        const paraNum = cfg.getDeclaringMethod().getParameters().length;
        return [...cfg.getBlocks()][0].getStmts()[paraNum];
    }

    // protected pathEdgeSetHasEdge(edge: PathEdge<D>) {
    //     for (const path of this.pathEdgeSet) {
    //         //this.problem.factEqual(path.edgeEnd.fact, edge.edgeEnd.fact);
    //         if (path.edgeEnd.node === edge.edgeEnd.node && this.problem.factEqual(path.edgeEnd.fact, edge.edgeEnd.fact) &&
    //             path.edgeStart.node === edge.edgeStart.node && this.problem.factEqual(path.edgeStart.fact, edge.edgeStart.fact)) {
    //             return true;
    //         }
    //     }
    //     return false;
    // }

    // protected propagate(edge: PathEdge<D>) {
    //     if (!this.pathEdgeSetHasEdge(edge)) {
    //         let index = this.workList.length;
    //         for (let i = 0; i < this.workList.length; i++) {
    //             if (this.laterEdges.has(this.workList[i])) {
    //                 index = i;
    //                 break;
    //             }
    //         }
    //         this.workList.splice(index, 0, edge);
    //         this.pathEdgeSet.add(edge);
    //     }
    // }

    // protected processExitNode(edge: PathEdge<D>) {
    //     // let startEdgePoint: PathEdgePoint<D> = edge.edgeStart;
    //     // let exitEdgePoint: PathEdgePoint<D> = edge.edgeEnd;
    //     // const summary = this.endSummary.get(startEdgePoint);
    //     // if (summary === undefined) {
    //     //     this.endSummary.set(startEdgePoint, new Set([exitEdgePoint]));
    //     // } else {
    //     //     summary.add(exitEdgePoint);
    //     // }
    //     // const callEdgePoints = this.inComing.get(startEdgePoint);
    //     // if (callEdgePoints === undefined) {
    //     //     if (startEdgePoint.node.getCfg()!.getDeclaringMethod() === this.problem.getEntryMethod()) {
    //     //         return;
    //     //     }
    //     //     throw new Error('incoming does not have ' + startEdgePoint.node.getCfg()?.getDeclaringMethod().toString());
    //     // }
    //     // for (let callEdgePoint of callEdgePoints) {
    //     //     let returnSite: Stmt = this.getReturnSiteOfCall(callEdgePoint.node);
    //     //     let returnFlowFunc: FlowFunction<D> = this.problem.getExitToReturnFlowFunction(exitEdgePoint.node, returnSite, callEdgePoint.node);
    //     //     let facts = returnFlowFunc.getDataFacts(exitEdgePoint.fact);
    //     //     let returnSitePoint: PathEdgePoint<D> = new PathEdgePoint<D>(returnSite, facts);
    //     //     this.propagate(new PathEdge<D>(exitEdgePoint, returnSitePoint));
    //         // for (let fact of returnFlowFunc.getDataFacts(exitEdgePoint.fact)) {
    //         //     let returnSitePoint: PathEdgePoint<D> = new PathEdgePoint<D>(returnSite, fact);
    //         //     let cacheEdge: CallToReturnCacheEdge<D> = new PathEdge<D>(callEdgePoint, returnSitePoint);
    //         //     let summaryEdgeHasCacheEdge = false;
    //         //     for (const sEdge of this.summaryEdge) {
    //         //         if (sEdge.edgeStart === callEdgePoint && sEdge.edgeEnd.node === returnSite && sEdge.edgeEnd.fact === fact) {
    //         //             summaryEdgeHasCacheEdge = true;
    //         //             break;
    //         //         }
    //         //     }
    //         //     if (!summaryEdgeHasCacheEdge) {
    //         //         this.summaryEdge.add(cacheEdge);
    //         //         let startOfCaller: Stmt = this.getStartOfCallerMethod(callEdgePoint.node);
    //         //         for (let pathEdge of this.pathEdgeSet) {
    //         //             if (pathEdge.edgeStart.node === startOfCaller && pathEdge.edgeEnd === callEdgePoint) {
    //         //                 this.propagate(new PathEdge<D>(pathEdge.edgeStart, returnSitePoint));
    //         //             }
    //         //         }
    //         //     }
    //         // }
    //         // let facts = returnFlowFunc.getDataFacts(exitEdgePoint.fact)
    //         // let returnSitePoint: PathEdgePoint<D> = new PathEdgePoint<D>(returnSite, facts);
    //         // let cacheEdge: CallToReturnCacheEdge<D> = new PathEdge<D>(callEdgePoint, returnSitePoint);
    //         // let summaryEdgeHasCacheEdge = false;
    //         // for (const sEdge of this.summaryEdge) {
    //         //     if (sEdge.edgeStart === callEdgePoint && sEdge.edgeEnd.node === returnSite && sEdge.edgeEnd.fact === facts) {
    //         //         summaryEdgeHasCacheEdge = true;
    //         //         break;
    //         //     }
    //         // }
    //         // if (!summaryEdgeHasCacheEdge) {
    //         //     this.summaryEdge.add(cacheEdge);
    //         //     let startOfCaller: Stmt = this.getStartOfCallerMethod(callEdgePoint.node);
    //         //     for (let pathEdge of this.pathEdgeSet) {
    //         //         if (pathEdge.edgeStart.node === startOfCaller && pathEdge.edgeEnd === callEdgePoint) {
    //         //             this.propagate(new PathEdge<D>(pathEdge.edgeStart, returnSitePoint));
    //         //         }
    //         //     }
    //         // }
            
    //     //}
    // }

    // protected processNormalNode(edge: PathEdge<D>) {
    //     let start: PathEdgePoint<D> = edge.edgeStart;
    //     // let end: PathEdgePoint<D> = edge.edgeEnd;
    //     // let stmts: Stmt[] = [...this.getChildren(end.node)].reverse();
    //     // for (let stmt of stmts) {
    //     //     let flowFunction: FlowFunction<D> = this.problem.getNormalFlowFunction(end.node, stmt);
    //     //     let set: Set<D> = flowFunction.getDataFacts(end.fact);
    //     //     for (let fact of set) {
    //     //         let edgePoint: PathEdgePoint<D> = new PathEdgePoint<D>(stmt, fact);
    //     //         const edge = new PathEdge<D>(end, edgePoint) // start => end
    //     //         this.propagate(edge);
    //     //         this.laterEdges.add(edge);
    //     //     }
    //     // }
    //     let end: PathEdgePoint<D> = edge.edgeEnd;
    //     //处理return边
    //     if (end.node instanceof ArkReturnStmt && this.returntoCall.get(end.node) !== undefined) {
    //         let calltoreturnsite: Stmt = this.getReturnSiteOfCall(this.returntoCall.get(end.node)!);
    //         let flowFunction: FlowFunction<D> = this.problem.getNormalFlowFunction(start.node, end.node);
    //         let set: Set<D> = flowFunction.getDataFacts(start.fact);
    //         let edgePoint: PathEdgePoint<D> = new PathEdgePoint<D>(end.node, set);
            
    //         this.stmttoFact.set(edgePoint.node,edgePoint.fact);
    //         if (this.stmttoFact.get(calltoreturnsite) === undefined) {
    //             let nextPoint: PathEdgePoint<D> = new PathEdgePoint<D>(calltoreturnsite, new Set<D>([this.zeroFact]));
    //             const edge = new PathEdge<D>(edgePoint, nextPoint) // start => end
    //             this.propagate(edge);
    //             this.laterEdges.add(edge);
    //         }
    //         else {
    //             let nextPoint: PathEdgePoint<D> = new PathEdgePoint<D>(calltoreturnsite, this.stmttoFact.get(calltoreturnsite)!);
    //             const edge = new PathEdge<D>(edgePoint, nextPoint) // start => end
    //             this.propagate(edge);
    //             this.laterEdges.add(edge);
    //         }
            
    //     }
    //     //处理return边数据流返回
    //     else if (start.node instanceof ArkReturnStmt) {
    //         let stmts: Stmt[] = [...this.getChildren(end.node)].reverse();
    //         for (let stmt of stmts) {
    //             //let stmt: Stmt = start.node as ArkReturnStmt;
    //             let callsite: Stmt = this.returntoCall.get(start.node)!;
    //             if (callsite instanceof ArkAssignStmt) {
    //                 let call = callsite as ArkAssignStmt;
    //                 let flowFunction: FlowFunction<D> = this.problem.getNormalFlowFunction(start.node, call);
    //                 let set: Set<D> = flowFunction.getDataFacts(start.fact);
    //                 let edgePoint: PathEdgePoint<D> = new PathEdgePoint<D>(end.node, set);
    //                 let nextPoint: PathEdgePoint<D> = new PathEdgePoint<D>(stmt, new Set<D>([this.zeroFact]));
    //                 const edge = new PathEdge<D>(edgePoint, nextPoint) // start => end
    //                 this.propagate(edge);
    //             }
    //         }
    //     }
    //     //处理normal边
    //     else {
    //         let stmts: Stmt[] = [...this.getChildren(end.node)].reverse();
    //         for (let stmt of stmts) {
    //             let flowFunction: FlowFunction<D> = this.problem.getNormalFlowFunction(start.node, end.node);
    //             let set: Set<D> = flowFunction.getDataFacts(start.fact);
    //             let edgePoint: PathEdgePoint<D> = new PathEdgePoint<D>(end.node, set);
    //             this.stmttoFact.set(edgePoint.node,edgePoint.fact);
    //             let nextPoint: PathEdgePoint<D> = new PathEdgePoint<D>(stmt,new Set<D>([this.zeroFact]));
    //             const edge = new PathEdge<D>(edgePoint, nextPoint) // start => end
    //             this.propagate(edge);
    //             this.laterEdges.add(edge);
    //         }
    //     }
    // }

    // protected processCallNode(edge: PathEdge<D>) {
    //     let start: PathEdgePoint<D> = edge.edgeStart;
    //     let callEdgePoint: PathEdgePoint<D> = edge.edgeEnd;
    //     const invokeStmt = callEdgePoint.node as ArkInvokeStmt;
    //     let callees: Set<ArkMethod>;
    //     if (this.scene.getFile(invokeStmt.getInvokeExpr().getMethodSignature().getDeclaringClassSignature().getDeclaringFileSignature())) {
    //         callees = this.getAllCalleeMethods(callEdgePoint.node as ArkInvokeStmt);
    //     } else {
    //         callees = new Set([getRecallMethodInParam(invokeStmt)!]);
    //     }
    //     let returnSite: Stmt = this.getReturnSiteOfCall(callEdgePoint.node);
    //     for (let callee of callees) {
    //         //let callFlowFunc: FlowFunction<D> = this.problem.getCallFlowFunction(invokeStmt, callee);
    //         if (!callee.getCfg()) {
    //             continue;
    //         }
    //         //let firstStmt: Stmt = [...callee.getCfg()!.getBlocks()][0].getStmts()[callee.getParameters().length];
    //         let firstStmt: Stmt = [...callee.getCfg()!.getBlocks()][0].getStmts()[0];
    //         let returindex = [...callee.getCfg()!.getBlocks()][0].getStmts().length - 1; //add
    //         let returnStmt: Stmt = [...callee.getCfg()!.getBlocks()][0].getStmts()[returindex]; //add
    //         this.returntoCall.set(returnStmt,callEdgePoint.node); //add
    //         //处理return-call边
    //         if (start.node instanceof ArkReturnStmt) {
    //             let callsite: Stmt = this.returntoCall.get(start.node)!;
    //             if (callsite instanceof ArkAssignStmt) {
    //                 let call = callsite as ArkAssignStmt;
    //                 let flowFunction: FlowFunction<D> = this.problem.getNormalFlowFunction(start.node, call);
    //                 let set: Set<D> = flowFunction.getDataFacts(start.fact);

    //                 /********************************* */ //单独检测taint
    //                 let flowFunctiontaint: FlowFunction<D> = this.problem.getNormalFlowFunction(start.node, callEdgePoint.node);
    //                 flowFunctiontaint.getDataFacts(set);
    //                 /********************************* */
    //                 let endPoint: PathEdgePoint<D> = new PathEdgePoint<D>(edge.edgeEnd.node, set);
    //                 let nextPoint: PathEdgePoint<D> = new PathEdgePoint<D>(firstStmt, new Set<D>([this.zeroFact]));
    //                 this.propagate(new PathEdge<D>(endPoint, nextPoint));
    //                 let returnSitePoint: PathEdgePoint<D> = new PathEdgePoint<D>(returnSite, new Set<D>([this.zeroFact]));
    //                 this.propagate(new PathEdge<D>(endPoint, returnSitePoint));
    //             }
    //         }
            
    //         //处理call边
    //         else {
    //             let flowFunction: FlowFunction<D> = this.problem.getNormalFlowFunction(edge.edgeStart.node, edge.edgeEnd.node);
    //             let facts: Set<D> = flowFunction.getDataFacts(edge.edgeStart.fact);
    //             let endPoint: PathEdgePoint<D> = new PathEdgePoint<D>(edge.edgeEnd.node, facts);
                
    //             let nextPoint: PathEdgePoint<D> = new PathEdgePoint<D>(firstStmt, new Set<D>([this.zeroFact]));
    //             this.propagate(new PathEdge<D>(endPoint, nextPoint));
    //             let returnSitePoint: PathEdgePoint<D> = new PathEdgePoint<D>(returnSite, new Set<D>([this.zeroFact]));
    //             this.propagate(new PathEdge<D>(endPoint, returnSitePoint));
    //         }
            
    //         // for (let fact of facts) {
    //         //     this.callNodeFactPropagate(edge, firstStmt, fact, returnSite);
    //         // }
    //         //this.callNodeFactPropagate(edge, firstStmt, facts, returnSite);
    //     }
        
    //     // let callToReturnflowFunc: FlowFunction<D> = this.problem.getCallToReturnFlowFunction(edge.edgeEnd.node, returnSite);
    //     // let set: Set<D> = callToReturnflowFunc.getDataFacts(callEdgePoint.fact);
    //     // // for (let fact of set) {
    //     // //     firstStmt // start => callEdgePoint
    //     // // }
    //     // this.propagate(new PathEdge<D>(callEdgePoint, new PathEdgePoint<D>(returnSite, set))); // start => callEdgePoint
    //     // for (let cacheEdge of this.summaryEdge) {
    //     //     if (cacheEdge.edgeStart === edge.edgeEnd && cacheEdge.edgeEnd.node === returnSite) {
    //     //         this.propagate(new PathEdge<D>(callEdgePoint, cacheEdge.edgeEnd)); // start => callEdgePoint
    //     //     }
    //     // }
    // }

    // protected callNodeFactPropagate(edge: PathEdge<D>, firstStmt: Stmt, fact: Set<D>, returnSite: Stmt): void {
    //     let callEdgePoint: PathEdgePoint<D> = edge.edgeEnd;
    //     // method start loop path edge
    //     let startEdgePoint: PathEdgePoint<D> = new PathEdgePoint(firstStmt, fact);
    //     this.propagate(new PathEdge<D>(callEdgePoint, startEdgePoint)); // startEdgePoint => callEdgePoint
    //     //add callEdgePoint in inComing.get(startEdgePoint)
    //     let coming: Set<PathEdgePoint<D>> | undefined;
    //     for (const incoming of this.inComing.keys()) {
    //         if (incoming.fact === startEdgePoint.fact && incoming.node === startEdgePoint.node) {
    //             coming = this.inComing.get(incoming);
    //             break;
    //         } 
    //     }
    //     if (coming === undefined) {
    //         this.inComing.set(startEdgePoint, new Set([callEdgePoint]));
    //     } else {
    //         coming.add(callEdgePoint);
    //     }
    //     let exitEdgePoints: Set<PathEdgePoint<D>> = new Set();
    //     for (const end of Array.from(this.endSummary.keys())) {
    //         if (end.fact === fact && end.node === firstStmt) {
    //             exitEdgePoints = this.endSummary.get(end)!;
    //         }
    //     }
    //     for (let exitEdgePoint of exitEdgePoints) {
    //         let returnFlowFunc = this.problem.getExitToReturnFlowFunction(exitEdgePoint.node, returnSite, callEdgePoint.node);
    //         // for (let returnFact of returnFlowFunc.getDataFacts(exitEdgePoint.fact)) {
    //         //     this.summaryEdge.add(new PathEdge<D>(edge.edgeEnd, new PathEdgePoint<D>(returnSite, returnFact)));
    //         // }
    //         let returnFact = returnFlowFunc.getDataFacts(exitEdgePoint.fact)
    //         this.summaryEdge.add(new PathEdge<D>(edge.edgeEnd, new PathEdgePoint<D>(returnSite, returnFact)));
    //     }
    // }

    protected doSolve() {
        while (this.workList.length !== 0) {
            let pathEdge: PathEdge = this.workList.shift()!;
            let tgtStmt = pathEdge.tgtStmt;
            let srcoutFact = this.problem.transferEdge(pathEdge,this.result);
            if(!this.result.stmt2InFacts.has(tgtStmt)) {
                let ZeroFact: Set<Value> = new Set<Value>([this.zeroFact]);
                this.result.stmt2InFacts.set(tgtStmt, new Fact(ZeroFact));
            }
            let tgtinFact = this.problem.meetInto(srcoutFact,this.result.stmt2InFacts.get(tgtStmt)!)
            let tgtoutFact = this.problem.transferNode(tgtStmt,tgtinFact);
            this.result.stmt2OutFacts.set(tgtStmt, tgtoutFact);
            this.icfg.getOutEdges(tgtStmt).forEach((e) => {
                this.workList.push(e); 
            })
        }
    }

    protected isCallStatement(stmt: Stmt): boolean {
        for (const expr of stmt.getExprs()) {
            if (expr instanceof AbstractInvokeExpr) {
                if (this.scene.getFile(expr.getMethodSignature().getDeclaringClassSignature().getDeclaringFileSignature())) {
                    return true;
                }
                if (stmt instanceof ArkInvokeStmt && getRecallMethodInParam(stmt)) {
                    return true;
                }
            }
        }
        return false;
    }

    protected isExitStatement(stmt: Stmt): boolean {
        return stmt instanceof ArkReturnStmt || stmt instanceof ArkReturnVoidStmt;
    }

    // public getPathEdgeSet(): Set<PathEdge<D>> {
    //     return this.pathEdgeSet;
    // }
}
