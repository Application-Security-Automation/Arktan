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

import { Stmt } from '../base/Stmt';
import { Value } from '../base/Value';
import { ArkMethod } from '../model/ArkMethod';
import { DataflowResult } from './DataflowResult';
import { PathEdge } from './Edge';
import { Fact } from './Fact';

export abstract class DataflowProblem<D> {


    // public transferEdge(srcStmt: Stmt, tgtStmt: Stmt) {
    //     let edgeKind: number = Edge.getKind(srcStmt, tgtStmt);

    //     if (0 === edgeKind) {
    //         //normal
    //     } else if (1 === edgeKind) { //Call-Edge

    //     } else if (2 === edgeKind) { //Return-Edge

    //     } else if (3 === edgeKind) { //Call-To-Return-Edge

    //     }
    // }

    abstract meetInto(f1: Fact,f2: Fact): Fact;
    abstract transferEdge(edge: PathEdge, res: DataflowResult): Fact;
    abstract transferNode(stmt: Stmt,inFact: Fact): Fact;
    /**
     * Transfer the outFact of srcStmt to the inFact of tgtStmt
     * 
     * Return true if keeping progagation (i.e., tgtStmt will be added to the WorkList for further analysis)
     */
    
    // abstract transferNormalEdge(srcStmt: Stmt, tgtStmt: Stmt, result: DataflowResult): boolean;
    abstract transferNormalEdge(edge: PathEdge, fact: Fact): Fact;
    abstract transferCallEdge(edge: PathEdge, fact: Fact): Fact;
    abstract transferCallToReturnEdge(edge: PathEdge, fact: Fact): Fact;
    abstract transferReturnEdge(edge: PathEdge, fact: Fact): Fact;
    
    // abstract transferCallToReturnEdge(srcStmt: Stmt, tgtStmt: Stmt, result: DataflowResult): boolean;

    // abstract transferCallEdge(srcStmt: Stmt, tgtStmt: Stmt, result: DataflowResult): boolean;

    // abstract transferReturnEdge(srcStmt: Stmt, tgtStmt: Stmt, result: DataflowResult): boolean;
    
    /*
    abstract getNormalFlowFunction(srcStmt:Stmt, tgtStmt:Stmt) : FlowFunction<D>;

    abstract getCallFlowFunction(srcStmt:Stmt, method:ArkMethod) : FlowFunction<D>;

    abstract getExitToReturnFlowFunction(srcStmt:Stmt, tgtStmt:Stmt, callStmt:Stmt) : FlowFunction<D>;

    abstract getCallToReturnFlowFunction(srcStmt:Stmt, tgtStmt:Stmt) : FlowFunction<D>;
    */

    abstract createZeroValue() : Value;

    abstract getEntryPoint() : Stmt;

    abstract getEntryMethod() : ArkMethod;

    abstract factEqual(d1: Set<D>, d2: Set<D>): boolean;
}

// export interface FlowFunction<D>  {
//     getDataFacts(d:D) : Set<D>;
// }
export interface FlowFunction<D>  {
    getDataFacts(d:Set<D>) : Set<D>;
}