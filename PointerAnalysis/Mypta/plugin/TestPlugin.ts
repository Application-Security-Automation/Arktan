import { FunctionType } from "../../../Arkanalyzer/core/base/Type";
import { CallEdge } from "../CallEdge";
import { MyPointerAnalysis } from "../MyPointerAnalysis";
import { TaintObj } from "../Obj";
import { Plugin } from "./Plugin";

export class TestPlugin implements Plugin {
    private solver! : MyPointerAnalysis;
    setSolver(solver: MyPointerAnalysis): void {
        this.solver = solver;
    }
    onStart(): void {
        //将待测试case的测试方法都添加到入口方法并标记source
        this.solver.scene.getMethods().forEach(m => {
            //if(m.getName().includes("_") && m.getSignature().toString().includes("lambda_expression")) {
            if(m.getSignature().getMethodSubSignature().getMethodName().startsWith("argument_passing_001_T")) {
                this.solver.cg.addEntryMethods(m);
                this.solver.entryPoints.push(m);
                let param = m.getParameterInstances()[0];
                let taintObj = new TaintObj(m.getSignature().toString()+"/param"+0,m.getParameterInstances()[0].getType());
                this.solver.addVarPointsTo(this.solver.ptrManager.getCSVar(param),taintObj);
            }
        })
        
    }
    onNewCallEdge(edge: CallEdge): void {
        let m = edge.getCallee();
        if(m.getName() === "getCurrentLocation") {
            let arg = edge.getCallSite().getCallSite().getInvokeExpr().getArgs()[1];
            if(arg.getType() instanceof FunctionType) {
                let func = (arg.getType() as FunctionType);
                let f = this.solver.scene.getMethod(func.getMethodSignature());
                if(f != null) {
                    let param = f.getParameterInstances()[0];
                    let taintObj = new TaintObj(f.getSignature().toString()+"/param"+0,m.getParameterInstances()[0].getType());
                    this.solver.addVarPointsTo(this.solver.ptrManager.getCSVar(param),taintObj);
                    this.solver.addMethod(f);
                }
            }
        }
    }
}