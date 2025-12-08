import { ArkInvokeStmt } from "../../Arkanalyzer/core/base/Stmt";
import { ArkMethod } from "../../Arkanalyzer/core/model/ArkMethod";
import { CallEdge } from "./CallEdge";
import { CallSite } from "./CallSite";
import { PointerManager } from "./PointerManager";

export class CallGraph {
    private entryMethods : Set<ArkMethod>;
    private reachableMethods : Set<ArkMethod>;
    private callSitesIn : Map<ArkMethod, CallSite[]>; // caller -> callsite
    //private callSiteToContainer : Map<CallSite, ArkMethod>; // callsite -> caller
    private callSiteToEdges : Map<CallSite, CallEdge>;  // callsite -> calledge
    private calleeToEdges : Map<ArkMethod, CallEdge[]>; // callee -> calledge
    private ptrmanager : PointerManager;
    constructor(ptrmanager : PointerManager) {
        //this.callSiteToContainer = new Map();
        this.callSiteToEdges = new Map();
        this.callSitesIn = new Map();
        this.calleeToEdges = new Map();
        this.entryMethods = new Set();
        this.reachableMethods = new Set();
        this.ptrmanager = ptrmanager;
    }
    addEntryMethods(entrymethod : ArkMethod) {
        if(!this.entryMethods.has(entrymethod))
            this.entryMethods.add(entrymethod);
    }
    addReachableMethod(reachablemethod : ArkMethod) {
        if(!this.reachableMethods.has(reachablemethod)) {
            this.reachableMethods.add(reachablemethod);
            reachablemethod.getCfg()?.getStmts().forEach(stmt => {
                if(stmt.containsInvokeExpr()) {
                    let cs = this.ptrmanager.getCallSite(stmt as ArkInvokeStmt);
                    if(cs != undefined) {
                        if(this.callSitesIn.has(reachablemethod)) {
                            let callsites = this.callSitesIn.get(reachablemethod)!;
                            callsites.push(cs);
                            this.callSitesIn.set(reachablemethod,callsites);
                            //this.callSiteToContainer.set(cs,reachablemethod);
                        }
                        else 
                            this.callSitesIn.set(reachablemethod,[cs]);
                    }
                    
                    
                }
            })
        }
    }
    addEdge(calledge : CallEdge) : boolean {
        if(!this.callSiteToEdges.has(calledge.getCallSite())) {
            this.callSiteToEdges.set(calledge.getCallSite(),calledge);
            if (calledge.getCallee() != null) {
                if(this.calleeToEdges.has(calledge.getCallee()!)) {
                    let edges = this.calleeToEdges.get(calledge.getCallee()!)!;
                    edges.push(calledge);
                    this.calleeToEdges.set(calledge.getCallee()!,edges);
                }
                else
                    this.calleeToEdges.set(calledge.getCallee()!,[calledge]);
            }
            else {
                // callee is undefined, library function call edge, only as the leaf node
                // todo
            }
            return true;
        }
        return false;
    }
    edgesInTo(m: ArkMethod) : CallEdge[] {
        let calledges = this.calleeToEdges.get(m);
        if(calledges != undefined) {
            return calledges;
        }
        return [];
    }
    getCallGraph() {
        let worklist = new Array<ArkMethod>();
        this.entryMethods.forEach(entry => worklist.push(entry));
        while(worklist.length != 0) {
            let m = worklist.shift()!;
            let callsites = this.callSitesIn.get(m);
            if(callsites != undefined) {
                callsites.forEach(cs => {
                    let edge = this.callSiteToEdges.get(cs);
                    if(edge != undefined) {
                        let callee = edge.getCallee()!;
                        worklist.push(callee);
                        console.log(m.getSignature().toString() + " -> " + callee.getSignature().toString());
                    }
                })
            }
        }
    }

}