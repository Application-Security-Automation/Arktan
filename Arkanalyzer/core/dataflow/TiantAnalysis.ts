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
import { DataflowProblem, FlowFunction } from './DataflowProblem';
import { Local } from '../base/Local';
import { Value } from '../base/Value';
import { ArkAssignStmt, ArkInvokeStmt, ArkReturnStmt, Stmt } from '../base/Stmt';
import { ArkMethod } from '../model/ArkMethod';
import { Constant } from '../base/Constant';
import { AbstractRef, ArkInstanceFieldRef, ArkStaticFieldRef } from '../base/Ref';
import { DataflowSolver} from './DataflowSolver';
import { AbstractBinopExpr, AbstractInvokeExpr, ArkInstanceInvokeExpr, ArkStaticInvokeExpr } from '../base/Expr';
import { UndefinedType } from '../base/Type';
import { FileSignature, NamespaceSignature } from '../model/ArkSignature';
import { ArkClass } from '../model/ArkClass';
import { ArkNamespace } from '../model/ArkNamespace';
import * as fs from 'fs';
// { Cfg } from '../graph/Cfg';
import { LocalEqual, RefEqual } from './Util';
import { PathEdge } from './Edge';
import { DataflowResult } from './DataflowResult';
import { Fact } from './Fact';
import { ReturnEdeg } from './ReturnEdge';
import { Taint } from '../base/Taint';

export class TiantAnalysisChecker extends DataflowProblem<Value> {
    zeroValue: Constant = new Constant('zeroValue', UndefinedType.getInstance());
    entryPoint: Stmt;
    entryMethod: ArkMethod;
    scene: Scene;
    classMap: Map<FileSignature | NamespaceSignature, ArkClass[]> = new Map<FileSignature | NamespaceSignature, ArkClass[]>();
    globalVariableMap: Map<FileSignature | NamespaceSignature, Local[]> = new Map<FileSignature | NamespaceSignature, Local[]>();
    sources: ArkMethod[] = [];
    sourcesbyparam!: ArkMethod;
    sinks: ArkMethod[] = [];
    taintflows: Set<string> = new Set<string>();
    constructor(stmt: Stmt, method: ArkMethod){
        super();
        this.entryPoint = stmt;
        this.entryMethod = method;
        this.scene = method.getDeclaringArkFile().getScene();
        this.globalVariableMap = this.scene.getGlobalVariableMap();
    }

    getEntryPoint(): Stmt {
        return this.entryPoint;
    }

    getEntryMethod(): ArkMethod {
        return this.entryMethod;
    }

    // private callSource(val: Value): boolean {
    //     if (val instanceof AbstractInvokeExpr) {
    //         for (const source of this.sources) {
    //             if (source.getSignature() === val.getMethodSignature()) {
    //                 return true;
    //             }
    //         }
    //     }
    //     return false;
    // }

    //判断Sink方法
    private isSink(val: Value): boolean {
        if (val instanceof AbstractInvokeExpr) {
            for (const sink of this.sinks) {
                if (sink.getSignature() === val.getMethodSignature()) {
                    return true;
                }
            }
        }
        return false;
    }
    //通过参数设置source
    private isSourcesbyparams(method: ArkMethod): boolean {
        if (this.sourcesbyparam.getSignature() === method.getSignature()){
            return true;
        }
        return false;
    }
    //通过参数设置source
    public setSourcesbyparams(method: ArkMethod): void {
        this.sourcesbyparam = method;
    }

    public setSources(methods: ArkMethod[]): void {
        this.sources = methods;
    }

    public setSinks(methods: ArkMethod[]): void {
        this.sinks = methods;
    }

    public transferEdge(edge: PathEdge, res: DataflowResult): Fact {
        let edgeKind: number = edge.kind;
        let srcStmt = edge.srcStmt;
        if (0 === edgeKind) { //normal
            return this.transferNormalEdge(edge, res.stmt2OutFacts.get(srcStmt)!);
        } else if (1 === edgeKind) { //Call-Edge
            return this.transferCallEdge(edge, res.stmt2OutFacts.get(srcStmt)!)
        } else if (2 === edgeKind) { //Return-Edge
            return this.transferReturnEdge(edge, res.stmt2OutFacts.get(srcStmt)!)
        } else if (3 === edgeKind) { //Call-To-Return-Edge
            return this.transferCallToReturnEdge(edge, res.stmt2OutFacts.get(srcStmt)!)
        }
        return res.stmt2OutFacts.get(srcStmt)!;
    }

    meetInto(f1: Fact,f2: Fact): Fact {
        let result = new Set([...f1.getValues()!, ...f2.getValues()!]);
        return new Fact(result); 
    }
    transferNode(stmt: Stmt,inFact: Fact): Fact {
        //判断sink
        stmt.getExprs().forEach(exp => {
            if(exp instanceof AbstractInvokeExpr && this.isSink(exp)) {
                const args = (exp as AbstractInvokeExpr).getArgs();
                args.forEach(arg => {
                    if (arg instanceof Local) {
                        (arg as Local).taint.forEach(t => {
                            if(t.isTaint) {                        
                                let taintflow = "TaintFlow: " + t.taintSrc + " -> " +  stmt.toString();
                                this.taintflows.add(taintflow)
                            }
                        })
                    }
                })
            }
        })
        if(stmt instanceof ArkAssignStmt) {
            let assstmt = stmt as ArkAssignStmt;
            let right = assstmt.getRightOp();
            let light = assstmt.getLeftOp() as Local;
            if (right instanceof AbstractInvokeExpr) {
                if(inFact.values.has(light)) {
                    inFact.values.delete(light);
                }
            }
            else {
                //右值为单个变量
                if (right instanceof Local) {
                    let r: Local = right as Local;
                    inFact.values.forEach(v => {
                        if(v instanceof Local && v.getName() === r.getName()) {
                            light.taint = v.taint;
                        }
                    })
                    inFact.values.add(light);
                }
                //右值为二元运算
                if (right instanceof AbstractBinopExpr) {
                    let l: Value = right.getOp1();
                    let r: Value = right.getOp2();
                    if(l instanceof Local ) {
                        l.taint.forEach(t => {
                            if(t.isTaint){
                                light.taint.add(t)
                            }
                        });
                    }
                    if(r instanceof Local) {
                        r.taint.forEach(t => {
                            if(t.isTaint){
                                light.taint.add(t)
                            }
                        });
                    }
                    inFact.values.add(light);
                }
            }
        }
        return inFact;
    }
    transferNormalEdge(edge: PathEdge, fact: Fact): Fact {
        //添加param型source
        if(edge.srcStmt instanceof ArkAssignStmt) {
            let stmt = edge.srcStmt as ArkAssignStmt;
            let assigned: Local = stmt.getLeftOp() as Local;
            if (stmt.toString().includes("parameter")) {
                let m = stmt.getCfg().getDeclaringMethod();
                if (this.isSourcesbyparams(m)) {
                    let t: Taint = new Taint();
                    t.isTaint = true;
                    t.taintSrc = m.getSignature().toString() + "/param";
                    assigned.taint.add(t);
                    fact.values.add(assigned);
                }
            }
        }
        return fact;
    }
    transferCallEdge(edge: PathEdge, fact: Fact): Fact {
        let ZeroFact: Set<Value> = new Set<Value>([this.createZeroValue()]);
        let resFact = new Fact(ZeroFact);
        let callexp = edge.srcStmt.getInvokeExpr()!;
        //函数调用时进行参数污点传播
        const args = callexp.getArgs();
        let l = args.length;
        for (let i=0; i<l; i++) {
            let paramstmt = edge.tgtStmt.getCfg().getStmts()[i] as ArkAssignStmt;
            let p = paramstmt.getLeftOp() as Local;
            p.taint = (args[i] as Local).taint;
            resFact.values.add(p);
        }
        return resFact;
    }
    transferCallToReturnEdge(edge: PathEdge, fact: Fact): Fact {
        return fact;
    }
    transferReturnEdge(edge: PathEdge, fact: Fact): Fact {
        let ZeroFact: Set<Value> = new Set<Value>([this.createZeroValue()]);
        let res = new Fact(ZeroFact);
        let returnedge = edge as ReturnEdeg;
        let callstmt = returnedge.getCallsite();
        let returnvar = (returnedge.srcStmt as ArkReturnStmt).getOp();
        if(callstmt instanceof ArkAssignStmt) {
            let stmt = callstmt as ArkAssignStmt;
            let assigned = stmt.getLeftOp() as Local;
            assigned.taint = (returnvar as Local).taint;
            res.values.add(assigned);
            return res;
        }
        return res;
    }


    // getNormalFlowFunction(srcStmt:Stmt, tgtStmt:Stmt): FlowFunction<Value> {
    //     // let checkerInstance: TiantAnalysisChecker = this;
    //     // return new class implements FlowFunction<Value> {
    //     //     getDataFacts(dataFact: Value): Set<Value> {
    //     //         let ret: Set<Value> = new Set();
    //     //         if (checkerInstance.getEntryPoint() === srcStmt && checkerInstance.getZeroValue() === dataFact) {
    //     //             let entryMethod = checkerInstance.getEntryMethod();
    //     //             const parameters =  [...(entryMethod.getCfg() as Cfg).getBlocks()][0].getStmts().slice(0,entryMethod.getParameters().length);
    //     //             for (let i = 0; i < parameters.length;i++) {
    //     //                 const para  = parameters[i].getDef();
    //     //                 if (para)
    //     //                     ret.add(para);
    //     //             }
    //     //             ret.add(checkerInstance.getZeroValue());
    //     //             // 加入所有的全局变量和静态属性（may analysis）
    //     //             const staticFields = entryMethod.getDeclaringArkClass().getStaticFields(checkerInstance.classMap);
    //     //             for (const field of staticFields) {
    //     //                 if (field.getInitializer() === undefined) {
    //     //                     ret.add(new ArkStaticFieldRef(field.getSignature()));
    //     //                 }
    //     //             }
    //     //             for (const local of entryMethod.getDeclaringArkClass().getGlobalVariable(checkerInstance.globalVariableMap)) {
    //     //                 ret.add(local);
    //     //             }
    //     //             return ret;
    //     //         } 
    //     //         if (!checkerInstance.factEqual(srcStmt.getDef()!, dataFact)) {
    //     //             if (!(dataFact instanceof Local && dataFact.getName() === srcStmt.getDef()!.toString()))
    //     //                 ret.add(dataFact);
    //     //         }
    //     //         if (srcStmt instanceof ArkAssignStmt ) {
    //     //             let stmt: ArkAssignStmt = (srcStmt as ArkAssignStmt);
    //     //             let assigned: Value = stmt.getLeftOp();
    //     //             let rightOp: Value = stmt.getRightOp();
    //     //             if (checkerInstance.checkTaintTransfer(rightOp)) {
    //     //                 checkerInstance.addTaintVar(assigned, "trans", srcStmt)
    //     //             }
    //     //             if (checkerInstance.getZeroValue() === dataFact) {
    //     //                 if (checkerInstance.callSource(rightOp)) {
    //     //                     ret.add(assigned);
    //     //                 }
    //     //             } else if (checkerInstance.factEqual(rightOp, dataFact) || rightOp.getType() instanceof UndefinedType) {
    //     //                 ret.add(assigned);
    //     //                 if (assigned instanceof ArkInstanceFieldRef) {
    //     //                 }
    //     //             } else if (dataFact instanceof ArkInstanceFieldRef && rightOp === dataFact.getBase()) {
    //     //                 const field = new ArkInstanceFieldRef(srcStmt.getLeftOp() as Local, dataFact.getFieldSignature());
    //     //                 ret.add(field);
    //     //             }
    //     //         }
                
    //     //         if (tgtStmt instanceof ArkAssignStmt) {
    //     //             let stmt: ArkAssignStmt = (srcStmt as ArkAssignStmt);
    //     //             let assigned: Value = stmt.getLeftOp();
    //     //             ret.add(assigned)
    //     //         }
    //     //         return ret;
    //     //     }
    //     // }
    //     let checkerInstance: TiantAnalysisChecker = this;
    //     return new class implements FlowFunction<Value> {
    //         getDataFacts(dataFact: Set<Value>): Set<Value> {
    //             let ret: Set<Value> = new Set();
    //             //处理return边
    //             if (srcStmt instanceof ArkReturnStmt && tgtStmt instanceof ArkAssignStmt) {
    //                 let call = tgtStmt as ArkAssignStmt;
    //                 let retval: Value = call.getLeftOp();
    //                 let returnval = srcStmt.getOp();
    //                 if (checkerInstance.callSource(call.getRightOp())){
    //                     retval.isTaint = true;
    //                     retval.taintSrc = call.toString();
    //                 }
    //                 if(returnval.isTaint) {
    //                     retval.isTaint = true;
    //                     retval.taintSrc = returnval.taintSrc;
    //                 }
    //                 ret.add(retval);
    //                 //右值为函数调用时判断sink
    //                 let right = call.getRightOp();
    //                 if (right instanceof AbstractInvokeExpr && checkerInstance.isSink(right)) {
    //                     const args = right.getArgs();
    //                     args.forEach(arg => {
    //                         if (arg instanceof Local && arg.isTaint) {
    //                             // console.log("TaintFlow: ", arg.taintSrc," -> ", tgtStmt.toString());
    //                             let taintflow = "TaintFlow: " + arg.taintSrc + " -> " +  tgtStmt.toString();
    //                             checkerInstance.taintflows.add(taintflow)
    //                         }
    //                     })
    //                 }
    //                 return ret;
    //             }
    //             dataFact.forEach(data => (
    //                 ret.add(data)
    //             ))
    //             // if (checkerInstance.getEntryPoint() === srcStmt && dataFact.has(checkerInstance.getZeroValue())) {
    //             //     let entryMethod = checkerInstance.getEntryMethod();      
    //             //     const parameters =  [...(entryMethod.getCfg() as Cfg).getBlocks()][0].getStmts().slice(0,entryMethod.getParameters().length);
    //             //     for (let i = 0; i < parameters.length;i++) {
    //             //         const para  = parameters[i].getDef();
    //             //         if (para)
    //             //             ret.add(para);
    //             //     }
    //             //     ret.add(checkerInstance.getZeroValue());
    //             //     // 加入所有的全局变量和静态属性（may analysis）
    //             //     const staticFields = entryMethod.getDeclaringArkClass().getStaticFields(checkerInstance.classMap);
    //             //     for (const field of staticFields) {
    //             //         if (field.getInitializer() === undefined) {
    //             //             ret.add(new ArkStaticFieldRef(field.getSignature()));
    //             //         }
    //             //     }
    //             //     for (const local of entryMethod.getDeclaringArkClass().getGlobalVariable(checkerInstance.globalVariableMap)) {
    //             //         ret.add(local);
    //             //     }
    //             //     //return ret;
    //             // } 
    //             //赋值语句中的污点传播
    //             if (srcStmt instanceof ArkAssignStmt) {
    //                 let stmt: ArkAssignStmt = (srcStmt as ArkAssignStmt);
    //                 let assigned: Local = stmt.getLeftOp() as Local;
    //                 let right: Value = stmt.getRightOp();
    //                 let hastaint = false;
    //                 let taint = "";
    //                 //右值为单个变量
    //                 if (right instanceof Local) {
    //                     let r: Local = right as Local;
    //                     ret.forEach(data => {
    //                         if(data instanceof Local && data.getName() === r.getName()) {
    //                             if(r.isTaint) {
    //                                 hastaint = true;
    //                                 taint = r.taintSrc;
    //                             }
    //                         }
    //                     })
    //                     if(hastaint) {
    //                         if (ret.has(assigned)) {
    //                             ret.forEach(data => {
    //                                 if(data instanceof Local && data.getName() === assigned.getName()) {
    //                                     data.isTaint = true;
    //                                     data.taintSrc = taint;
    //                                 }
    //                             })
    //                         }
    //                         else {
    //                             assigned.isTaint = true;
    //                             assigned.taintSrc = taint;
    //                             ret.add(assigned);
    //                         }
    //                     }
    //                 }
    //                 //右值为二元表达式"+"
    //                 if (right instanceof AbstractBinopExpr) {
    //                     let l: Value = right.getOp1();
    //                     let r: Value = right.getOp2();
    //                     ret.forEach(data => {
    //                         if((data instanceof Local && l instanceof Local && data.getName() === l.getName()) || (data instanceof Local && r instanceof Local && data.getName() === r.getName())) {
    //                             if(r.isTaint) {
    //                                 hastaint = true;
    //                                 taint = r.taintSrc;
    //                             }
    //                             if(l.isTaint) {
    //                                 hastaint = true;
    //                                 taint = l.taintSrc;
    //                             }
    //                         }
    //                     })
    //                     if(hastaint) {
    //                         if (ret.has(assigned)) {
    //                             ret.forEach(data => {
    //                                 if(data instanceof Local && data.getName() === assigned.getName()) {
    //                                     data.isTaint = true;
    //                                     data.taintSrc = taint;
    //                                 }
    //                             })
    //                         }
    //                         else {
    //                             assigned.isTaint = true;
    //                             assigned.taintSrc = taint;
    //                             ret.add(assigned);
    //                         }
    //                     }
    //                 }
    //                 //右值为函数调用时进行参数污点传播
    //                 if (right instanceof AbstractInvokeExpr && tgtStmt.toString().includes("parameter")) {
    //                     const args = right.getArgs();
    //                     args.forEach(arg => {
    //                         if(arg instanceof Local && arg.isTaint) {
    //                             let a = (tgtStmt as ArkAssignStmt).getLeftOp();
    //                             a.isTaint = true;
    //                             a.taintSrc = arg.taintSrc;
    //                             ret.delete(arg);
    //                         }
    //                     })
    //                 }
    //                 //添加param型source
    //                 if (stmt.toString().includes("parameter")) {
    //                     let m = stmt.getCfg().getDeclaringMethod();
    //                     if (checkerInstance.isSourcesbyparams(m)) {
    //                         assigned.isTaint = true;
    //                         assigned.taintSrc = m.getSignature().toString() + "/param";
    //                         ret.add(assigned);
    //                     }
    //                 }
    //             }
    //             //处理正常赋值语句
    //             if (tgtStmt instanceof ArkAssignStmt) {
    //                 let stmt: ArkAssignStmt = (tgtStmt as ArkAssignStmt);
    //                 //右值为函数调用时判断sink
    //                 let right = stmt.getRightOp();
    //                 if (right instanceof AbstractInvokeExpr && checkerInstance.isSink(right)) {
    //                     const args = right.getArgs();
    //                     args.forEach(arg => {
    //                         if (arg instanceof Local && arg.isTaint) {
    //                             // console.log("TaintFlow: ", arg.taintSrc," -> ", tgtStmt.toString());
    //                             let taintflow = "TaintFlow: " + arg.taintSrc + " -> " +  tgtStmt.toString();
    //                             checkerInstance.taintflows.add(taintflow)
    //                         }
    //                     })
    //                     return ret;
    //                 }
    //                 let assigned: Value = stmt.getLeftOp();
    //                 ret.add(assigned)
                    
    //             }
    //             //输出污点流
    //             if (tgtStmt instanceof ArkInvokeStmt) { 
    //                 if(checkerInstance.isSink(tgtStmt.getInvokeExpr())){
    //                     const args = tgtStmt.getInvokeExpr().getArgs();
    //                     args.forEach(arg => {
    //                         if (arg instanceof Local && arg.isTaint) {
    //                             //console.log("TaintFlow: ", arg.taintSrc," -> ", tgtStmt.toString());
    //                             let taintflow = "TaintFlow: " + arg.taintSrc + " -> " +  tgtStmt.toString();
    //                             checkerInstance.taintflows.add(taintflow)
    //                         }
    //                     })
    //                 }
                    
    //             }
    //             return ret;
    //         }
    //     }
    // }

    getCallFlowFunction(srcStmt:Stmt, method:ArkMethod): FlowFunction<Value> {
        let checkerInstance: TiantAnalysisChecker = this;
        return new class implements FlowFunction<Value> {
            getDataFacts(dataFact: Set<Value>): Set<Value> {
                const ret:Set<Value> = new Set();
                //if (checkerInstance.getZeroValue() === dataFact) {
                if (dataFact.has(checkerInstance.getZeroValue())) {
                    ret.add(checkerInstance.getZeroValue());
                    // 加上调用函数能访问到的所有静态变量，如果不考虑多线程，加上所有变量，考虑则要统计之前已经处理过的变量并排除
                    for (const field of method.getDeclaringArkClass().getStaticFields(checkerInstance.classMap)) {
                        if (field.getInitializer() === undefined) {
                            ret.add(new ArkStaticFieldRef(field.getSignature()));
                        }
                    }
                    for (const local of method.getDeclaringArkClass().getGlobalVariable(checkerInstance.globalVariableMap)) {
                        ret.add(local);
                    }
                } else {
                    const callExpr = srcStmt.getExprs()[0] as AbstractInvokeExpr;
                    if (callExpr instanceof ArkInstanceInvokeExpr && dataFact instanceof ArkInstanceFieldRef && callExpr.getBase().getName() === dataFact.getBase().getName()){
                        // todo:base转this
                        const _this = [...srcStmt.getCfg()!.getBlocks()][0].getStmts()[0].getDef();
                        const thisRef = new ArkInstanceFieldRef(_this as Local, dataFact.getFieldSignature());
                        ret.add(thisRef);
                    } else if (callExpr instanceof ArkStaticInvokeExpr && dataFact instanceof ArkStaticFieldRef && callExpr.getMethodSignature().getDeclaringClassSignature() === dataFact.getFieldSignature().getDeclaringSignature()) {
                        ret.add(dataFact);
                    }
                    for (const sink of checkerInstance.sinks) {
                        if (callExpr.getMethodSignature() === sink.getSignature()) {
                            // for (const param of callExpr.getArgs()) {
                            //     if (checkerInstance.taintVar.has(param)) {
                            //         // console.log(param)
                            //         console.log("sink: "+ srcStmt.getOriginPositionInfo().toString() + ", " + srcStmt.toString());
                            //     }
                            //     // if (checkerInstance.factEqual(param, dataFact)) {
                            //     //     console.log("source: " + dataFact);
                            //     //     console.log("sink: "+ srcStmt.getOriginPositionInfo().toString() + ", " + srcStmt.toString());
                            //     // }
                            // }
                        }
                    }
                }
                const callStmt = srcStmt as ArkInvokeStmt;
                const args = callStmt.getInvokeExpr().getArgs();
                for (let i = 0; i < args.length; i++){

                    // if (args[i] === dataFact || checkerInstance.callSource(args[i]) && checkerInstance.getZeroValue() === dataFact){
                    //     const realParameter = [...(method.getCfg() as Cfg).getBlocks()][0].getStmts()[i].getDef();
                    //     if (realParameter){
                    //         ret.add(realParameter);
                    //         // console.log(realParameter)
                    //         if (checkerInstance.taintVar.has(args[i])) {
                    //             // TODO
                    //             checkerInstance.addTaintVar(realParameter, "trans", srcStmt)
                    //         }
                    //     }

                    // } else if (dataFact instanceof ArkInstanceFieldRef && dataFact.getBase().getName() === args[i].toString()){
                    //     const realParameter = [...(method.getCfg() as Cfg).getBlocks()][0].getStmts()[i].getDef();
                    //     if (realParameter) {
                    //         const retRef = new ArkInstanceFieldRef(realParameter as Local, dataFact.getFieldSignature());
                    //         ret.add(retRef);
                    //     }
                    // }
                }

                return ret;
            }

        }
    }

    getExitToReturnFlowFunction(srcStmt:Stmt, tgtStmt:Stmt, callStmt:Stmt): FlowFunction<Value> {
        //let checkerInstance: TiantAnalysisChecker = this;
        return new class implements FlowFunction<Value> {
            getDataFacts(dataFact: Set<Value>): Set<Value> {
                let ret: Set<Value> = new Set<Value>();
                // if (dataFact === checkerInstance.getZeroValue()) {
                //     ret.add(checkerInstance.getZeroValue());
                // }
                if (dataFact instanceof ArkInstanceFieldRef && dataFact.getBase().getName() === "this"){
                    // todo:this转base。
                    const expr = callStmt.getExprs()[0];
                    if (expr instanceof ArkInstanceInvokeExpr){
                        const fieldRef = new ArkInstanceFieldRef(expr.getBase(),dataFact.getFieldSignature());
                        ret.add(fieldRef);
                    }
                }
                if (!(callStmt instanceof ArkAssignStmt)) {
                    return ret;
                }
                if (callStmt instanceof ArkAssignStmt) { //add

                    let leftOp: Value = callStmt.getLeftOp();
                    ret.add(leftOp);
                }
                // if (srcStmt instanceof ArkReturnStmt) {
                //     let ass: ArkAssignStmt = callStmt as ArkAssignStmt;
                //     let leftOp: Value = ass.getLeftOp();
                //     let retVal: Value = (srcStmt as ArkReturnStmt).getOp();
                //     if (dataFact === checkerInstance.getZeroValue()) {
                //         ret.add(checkerInstance.getZeroValue());
                //         if (checkerInstance.callSource(retVal) || checkerInstance.callSource(ass.getRightOp())) {
                //             ret.add(leftOp);
                //             checkerInstance.addTaintVar(leftOp, "source", callStmt)
                //         }
                //     } else if (retVal === dataFact) {
                //         ret.add(leftOp);
                //     }
                // }
                return ret;
            }

        }
    }

    getCallToReturnFlowFunction(srcStmt:Stmt, tgtStmt:Stmt): FlowFunction<Value> {
        let checkerInstance: TiantAnalysisChecker = this;
        return new class implements FlowFunction<Value> {
            getDataFacts(dataFact: Set<Value>): Set<Value> {
                const ret:Set<Value> = new Set();
                if (dataFact.has(checkerInstance.getZeroValue())) {
                    ret.add(checkerInstance.getZeroValue());
                }
                // const defValue = srcStmt.getDef();
                // if (!(defValue && defValue === dataFact)){
                //     ret.add(dataFact);
                // }
                return ret;
            }

        }
    }

    createZeroValue(): Value {
        return this.zeroValue;
    }

    getZeroValue(): Value {
        return this.zeroValue;
    }

    Json2ArkMethod(path: string): ArkMethod[] {
        
        let arkMethods: ArkMethod[] = [];
        const data = fs.readFileSync(path, 'utf-8');
        const objects = JSON.parse(data)
        for (const object of objects) {
            const file = this.scene.getFile(new FileSignature(object.sdkName, object.file));
            if (!file) {
                console.log("no file: " + object.file);
                continue;
            }
            let arkClass: ArkClass | null = null;
            if (object.namespace === "_") {
                for (const clas of file.getClasses()) {
                    if (clas.getName() === object.class) {
                        arkClass = clas;
                        break;
                    }
                }
            } else {
                let arkNamespace: ArkNamespace | null = null;
                for (const ns of file.getNamespaces()) {
                    if (ns.getName() === object.namespace) {
                        arkNamespace = ns;
                        break;
                    }
                }
                if (arkNamespace) {
                    for (const clas of arkNamespace.getClasses()) {
                        if (clas.getName() === object.class) {
                            arkClass = clas;
                            break;
                        }
                    }
                } else {
                    console.log("no namespace: " + object.namespace);
                    continue;
                }
            }
            if (!arkClass) {
                console.log("no class: " + object.class);
                continue;
            } else {
                let arkMethod: ArkMethod | null = null;
                for (const method of arkClass.getMethods()) {
                    if (method.getName() === object.method) {
                        arkMethod = method;
                        break;
                    }
                }
                if (arkMethod) {
                    arkMethods.push(arkMethod);
                } else {
                    console.log("no method: " + object.method);
                    continue;
                }
            }
        }
        return arkMethods;
    }
    
    factEqual(d1: Set<Value>, d2: Set<Value>): boolean {
        if (d1 instanceof Constant && d2 instanceof Constant) {
            return d1 === d2;
        } else if (d1 instanceof Local && d2 instanceof Local) {
            return LocalEqual(d1, d2);
        } else if (d1 instanceof AbstractRef && d2 instanceof AbstractRef) {
            return RefEqual(d1, d2);
        }
        return false;
    }
}

export class TiantAnalysisSolver extends DataflowSolver<Value> {
    constructor(problem: TiantAnalysisChecker, scene: Scene){
        super(problem, scene);
    }
}