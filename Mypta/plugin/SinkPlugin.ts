import { CallSite } from "../CallSite";
import { TaintConfig } from "../config/TaintConfig";
import { MyPointerAnalysis } from "../MyPointerAnalysis";
import { TaintObj } from "../Obj";
import { Sink } from "../Sink";
import { TaintFlow } from "../TaintFlow";
import { Plugin } from "./Plugin";

export class SinkPlugin implements Plugin {
    private solver! : MyPointerAnalysis;
    private sinks : Sink[];
    setSolver(solver: MyPointerAnalysis): void {
        this.solver = solver;
    }
    constructor(config: TaintConfig) {
        this.sinks = new Array();
        config.getSinks().forEach(s => {
            this.sinks.push(s);
        })
    }
    onFinish(): void {
        let taintflows = new Array<TaintFlow>();
        this.sinks.forEach(sink => {
            this.solver.cg.edgesInTo(sink.getMethod()).forEach(edge => {
                let cs = edge.getCallSite();
                let tf = this.FindTaintFlows(cs,sink);
                if(tf != null) {
                    taintflows.push(...tf);
                }
            })
        })
        taintflows.forEach(tf => {
            console.log(tf.toString());
        })
    }
    FindTaintFlows(cs: CallSite, sink: Sink) : TaintFlow[] {
        let index = sink.getIndex();
        let invoke = cs.getCallSite();
        let arg = invoke.getInvokeExpr().getArg(index);
        let tfres = new Array<TaintFlow>();
        let sinkpoint = "<" + cs.getCaller()?.getSignature().toString() + "> " + invoke.getInvokeExpr().toString() + "/" + index;
        this.solver.ptrManager.getCSVar(arg).getObjects().forEach(obj => {
            if(obj instanceof TaintObj) {
                tfres.push(new TaintFlow(obj.getSourcePoint(),sinkpoint));
            }
        })
        return tfres;
    }
}