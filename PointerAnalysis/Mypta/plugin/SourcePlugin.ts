import { ArkAssignStmt } from "../../../Arkanalyzer/core/base/Stmt";
import { ArkMethod } from "../../../Arkanalyzer/core/model/ArkMethod";
import { CallEdge } from "../CallEdge";
import { CallSite } from "../CallSite";
import { CallSource } from "../CallSource";
import { TaintConfig } from "../config/TaintConfig";
import { MyPointerAnalysis } from "../MyPointerAnalysis";
import { TaintObj } from "../Obj";
import { ParamSource } from "../ParamSource";
import { Plugin } from "./Plugin";

export class SourcePlugin implements Plugin {
    private callsources : Map<ArkMethod, CallSource>;
    private paramsources : Map<ArkMethod, ParamSource[]>;
    private solver! : MyPointerAnalysis;
    setSolver(solver: MyPointerAnalysis): void {
        this.solver = solver;
    }
    constructor(config: TaintConfig) {
        this.callsources = new Map();
        this.paramsources = new Map();
        config.getCallSources().forEach(src => {
            this.callsources.set(src.getMethod(),src);
        })
        config.getParamSources().forEach(src => {
            if(this.paramsources.get(src.getMethod()) != undefined) {
                let sources = this.paramsources.get(src.getMethod())!;
                sources.push(src);
                this.paramsources.set(src.getMethod(),sources);
            }
            else {
                this.paramsources.set(src.getMethod(),[src]);
            }
        })
    }
    onNewMethod(method: ArkMethod): void {
        this.processParamSource(method);
        
    }
    processParamSource(method: ArkMethod) {
        let sources = this.paramsources.get(method);
        if(sources != undefined) {
            sources.forEach(src => {
                let param = method.getParameterInstances()[src.getIndex()];
                let taintObj = new TaintObj(method.getSignature().toString()+"/param"+src.getIndex(),src.getType());
                this.solver.addVarPointsTo(this.solver.ptrManager.getCSVar(param),taintObj);
            })
        }
    }
    onNewCallEdge(edge: CallEdge): void {
        let source = this.callsources.get(edge.getCallee());
        if(source != undefined) {
            this.processCallSource(source,edge.getCallSite());
        }
    }
    processCallSource(source: CallSource, cs: CallSite) {
        let stmt = cs.getCallSite();
        if(stmt instanceof ArkAssignStmt) {
            let lhs = (stmt as ArkAssignStmt).getLeftOp();
            source.getMethod().getReturnStmt().forEach(ret => {
                let taintObj = new TaintObj(source.getMethod().getSignature().toString()+"/returnvar",source.getType());
                this.solver.addVarPointsTo(this.solver.ptrManager.getCSVar(lhs),taintObj);
            })
        }
    }
}