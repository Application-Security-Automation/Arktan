import { CallGraph } from "./CallGraph";
import { Constant, NumberConstant, StringConstant } from "../../src/core/base/Constant";
import { AbstractBinopExpr, ArkInstanceInvokeExpr, ArkNewArrayExpr, ArkNewExpr, ArkStaticInvokeExpr } from "../../src/core/base/Expr";
import { Local } from "../../src/core/base/Local";
import { AbstractFieldRef, ArkArrayRef, ArkInstanceFieldRef, ArkStaticFieldRef } from "../../src/core/base/Ref";
import { ArkAssignStmt, ArkInvokeStmt, ArkReturnStmt, Stmt } from "../../src/core/base/Stmt";
import { AnyType, ArrayType, ClassType, FunctionType } from "../../src/core/base/Type";
import { GLOBAL_THIS } from "../../src/core/common/TSConst";
import { ArkMethod } from "../../src/core/model/ArkMethod";
import { Scene } from "../../src/Scene";
import { CallEdge } from "./CallEdge";
import { ArrayObj, NewObj, NumberConObj, Obj, StrConObj } from "./Obj";
import { CSVar, Pointer } from "./Pointer";
import { PointerFlowEdge } from "./PointerFlowEdge";
import { PointerFlowGraph } from "./PointerFlowGraph";
import { PointerManager } from "./PointerManager";
import { PointsToSet } from "./PointsToSet";
import { pointerEntry, WorkList } from "./WorkList";
import { PluginManager } from "./plugin/PluginManager";
import { EntryPointPlugin } from "./plugin/EntryPointPlugin";
import { TaintConfig } from "./config/TaintConfig";
import { SourcePlugin } from "./plugin/SourcePlugin";
import { SinkPlugin } from "./plugin/SinkPlugin";
import { TaintTransferPlugin } from "./plugin/TaintTransferPlugin";

export class MyPointerAnalysis {
    entryPoints: ArkMethod[];
    cg: CallGraph;
    pfg: PointerFlowGraph;
    scene: Scene;
    worklist: WorkList;
    ptrManager: PointerManager;
    plugin: PluginManager;
    config: TaintConfig;
    constructor(s: Scene) {
        this.scene = s;
        this.worklist = new WorkList();
        this.pfg = new PointerFlowGraph();
        this.ptrManager = new PointerManager();
        this.cg = new CallGraph(this.ptrManager);
        this.entryPoints = new Array();
        this.plugin = new PluginManager();
        this.config = new TaintConfig(s,"./tests/Mypta/config/taint_config.yml");
    }
    start() {
        this.init();
        this.solve();
        //this.cg.getCallGraph();
    }
    init() {
        this.plugin.addPlugin(new EntryPointPlugin());
        this.plugin.addPlugin(new SourcePlugin(this.config));
        this.plugin.addPlugin(new SinkPlugin(this.config));
        this.plugin.addPlugin(new TaintTransferPlugin(this.config));
        this.plugin.setSolver(this);
        this.plugin.onStart();
        this.SolveEntryPoints();
    }
    solve() {
        while(!this.worklist.isEmpty()) {
            let entry = this.worklist.pollEntry();
            if(entry instanceof CallEdge) {
                let calledge = entry as CallEdge;
                this.processCallEdge(calledge);
            }
            if(entry instanceof pointerEntry) {
                let pointerentry = entry as pointerEntry;
                this.processPointerEntry(pointerentry);
            }
        }
        this.plugin.onFinish();
    }
    processPointerEntry(pointerentry: pointerEntry) {
        let pointer = pointerentry.getPointer();
        let pts = pointerentry.getPts();
        let diff = this.propagate(pointer,pts);
        if(diff != null && pointer instanceof CSVar) {
            let v = pointer as CSVar;
            let localv = v.getVar() as Local;
            localv.getUsedStmts().forEach(stmt => {
                //处理引用方法调用
                if(stmt.containsInvokeExpr() && stmt.getInvokeExpr() instanceof ArkInstanceInvokeExpr) {
                    let invokestmt = stmt as ArkInvokeStmt;
                    let invoke = stmt.getInvokeExpr() as ArkInstanceInvokeExpr;
                    if(invoke.getBase() === localv) {
                        diff.getObjects().forEach(obj => {
                            let callee = this.resolveCallByobj(obj,invokestmt);
                            if(callee != null) {
                                this.addCallEdge(new CallEdge("instanceinvoke",this.ptrManager.getCallSite(invokestmt)!,callee));
                                let thisvar = callee.getThisInstance();
                                if(thisvar != null) {
                                    this.addVarPointsTo(this.ptrManager.getCSVar(thisvar),obj);
                                }
                            }
                        })
                    }
                }
                //处理字段load、store
                else if(stmt instanceof ArkAssignStmt && stmt.containsFieldRef()) {
                    if(this.isFieldLoadStmt(stmt as ArkAssignStmt,localv)){
                        let loadstmt = stmt as ArkAssignStmt;
                        let lhs = loadstmt.getLeftOp();
                        let field = (loadstmt.getFieldRef() as ArkInstanceFieldRef);
                        diff.getObjects().forEach(obj => {
                            this.addPFGEdge(new PointerFlowEdge(this.ptrManager.getInstanceField(obj,field),this.ptrManager.getCSVar(lhs)));
                        })
                    }
                    if(this.isFieldStroeStmt(stmt as ArkAssignStmt,localv)){
                        let storestmt = stmt as ArkAssignStmt;
                        let rhs = storestmt.getRightOp();
                        let field = (storestmt.getFieldRef() as ArkInstanceFieldRef);
                        diff.getObjects().forEach(obj => {
                            this.addPFGEdge(new PointerFlowEdge(this.ptrManager.getCSVar(rhs),this.ptrManager.getInstanceField(obj,field)));
                        })
                    }
                }
                //处理数组load、store
                else if(stmt.containsArrayRef()) {
                    if(this.isArrayLoadStmt(stmt as ArkAssignStmt,localv)){
                        let loadstmt = stmt as ArkAssignStmt;
                        let lhs = loadstmt.getLeftOp();
                        let arr = (loadstmt.getArrayRef() as ArkArrayRef);
                        let index = '';
                        if(arr.getIndex() instanceof NumberConstant)
                            index = (arr.getIndex() as NumberConstant).getValue();
                        else {
                            this.ptrManager.getCSVar(arr.getIndex()).getObjects().forEach(o => {
                                if(o instanceof NumberConObj) {
                                    index = o.getContant();
                                }
                            })
                        }
                        diff.getObjects().forEach(obj => {
                            this.addPFGEdge(new PointerFlowEdge(this.ptrManager.getArrayIndex(obj,index),this.ptrManager.getCSVar(lhs)));
                        })
                    }
                    if(this.isArrayStoreStmt(stmt as ArkAssignStmt,localv)){
                        let storestmt = stmt as ArkAssignStmt;
                        let rhs = storestmt.getRightOp();
                        let arr = (storestmt.getLeftOp() as ArkArrayRef);
                        let index  = '';
                        if(arr.getIndex() instanceof NumberConstant)
                            index = (arr.getIndex() as NumberConstant).getValue();
                        else {
                            this.ptrManager.getCSVar(arr.getIndex()).getObjects().forEach(o => {
                                if(o instanceof NumberConObj) {
                                    index = o.getContant();
                                }
                            })
                        }
                        diff.getObjects().forEach(obj => {
                            this.addPFGEdge(new PointerFlowEdge(this.ptrManager.getCSVar(rhs),this.ptrManager.getArrayIndex(obj,index)));
                        })
                    }
                }
            })

        }
    }
    isArrayStoreStmt(stmt: ArkAssignStmt, v: Local) {
        let lhs = stmt.getLeftOp();
        if(lhs instanceof ArkArrayRef && (lhs as ArkArrayRef).getBase() === v) {
            return true;
        }
        return false;
    }
    isArrayLoadStmt(stmt: ArkAssignStmt, v: Local) {
        let rhs = stmt.getRightOp();
        if(rhs instanceof ArkArrayRef && (rhs as ArkArrayRef).getBase() === v) {
            return true;
        }
        return false;
    }
    isFieldStroeStmt(stmt: ArkAssignStmt, v: Local) : boolean {
        let lhs = stmt.getLeftOp();
        if(lhs instanceof ArkInstanceFieldRef && (lhs as ArkInstanceFieldRef).getBase() === v) {
            return true;
        }
        return false;
    }
    isFieldLoadStmt(stmt: ArkAssignStmt, v: Local) : boolean {
        let rhs = stmt.getRightOp();
        if(rhs instanceof ArkInstanceFieldRef && (rhs as ArkInstanceFieldRef).getBase() === v) {
            return true;
        }
        return false;
    }
    resolveCallByobj(obj: Obj, invokestmt: ArkInvokeStmt) : ArkMethod | null {
        if(obj instanceof StrConObj) {
            let c = this.scene.NativeClass.get("string")!;
            let method = invokestmt.getInvokeExpr().getMethodSignature();
            let callee = c.getMethod(method);
            if(callee != null) {
                return callee;
            }
        }
        else if(obj.getType() instanceof ClassType){
            let c = this.scene.getClass(obj.getType().getClassSignature());
            let method = invokestmt.getInvokeExpr().getMethodSignature();
            while(c != null) {
                let callee = c.getMethod(method);
                if(callee != null) {
                    return callee;
                }
                c = c.getSuperClass();
            }
        }
        return null;
    }
    propagate(pointer: Pointer, pts: PointsToSet) : PointsToSet | null {
        if(pointer.getPointsToSet() == undefined) {
            pointer.setPointsToSet(new PointsToSet(new Set<Obj>()));
        }
        pts.getObjects().forEach(o => {
            if(o instanceof ArrayObj && o.getType() instanceof ArrayType) {
                let arrtype = o.getType();
                if(arrtype.getBaseType() instanceof AnyType) {
                    let csvar = pointer as CSVar;
                    let type = (csvar.getType() as ArrayType);
                    if(!(type.getBaseType() instanceof AnyType)) {
                        o.setType(type);
                    }
                        
                }
            }
        })
        let diff = pointer.getPointsToSet()?.addAllDiff(pts);
        if(diff != null) {
            this.pfg.getOutEdgesOf(pointer).forEach(edge => {
                let target = edge.Gettarget();
                this.addPointsTo(target,diff);
            })
            return diff;
        }
        return null;
    }
    processCallEdge(calledge: CallEdge) {
        this.cg.addEdge(calledge);
        let method = calledge.getCallee();
        this.addMethod(method);
        //处理方法参数指针传播
        let args = calledge.getCallSite().getCallSite().getInvokeExpr().getArgs();
        let params = method.getParameterInstances();
        for(let i=0; i<args.length; i++) {
            let edge = new PointerFlowEdge(this.ptrManager.getCSVar(args[i]), this.ptrManager.getCSVar(params[i]));
            this.addPFGEdge(edge);
        }
        if(method.getDeclaringArkClass().getName() != "String") {
            //处理方法返回值指针传播
            if(calledge.getCallSite().getCallSite() instanceof ArkAssignStmt) {
                let lhs = (calledge.getCallSite().getCallSite() as unknown as ArkAssignStmt).getLeftOp();
                method.getReturnStmt().forEach(returnstmt => {
                    let returnvar = (returnstmt as ArkReturnStmt).getOp();
                    let edge = new PointerFlowEdge(this.ptrManager.getCSVar(returnvar), this.ptrManager.getCSVar(lhs));
                    this.addPFGEdge(edge);
                })
            }
        }
        
        this.plugin.onNewCallEdge(calledge);
    }
    addPFGEdge(edge: PointerFlowEdge) {
        this.pfg.addEdge(edge);
        let pts = edge.Getsource().getPointsToSet();
        if(pts != undefined) {
            this.addPointsTo(edge.Gettarget(),pts);
        }
    }
    SolveEntryPoints() {
        this.entryPoints.forEach(m => this.addMethod(m));
    }
    addMethod(arkm: ArkMethod) {
        this.cg.addReachableMethod(arkm);
        this.plugin.onNewMethod(arkm);
        arkm.getCfg()?.getStmts().forEach(stmt => {
            this.addStmts(stmt);
        })
    }
    addStmts(stmt: Stmt) {
        if(stmt instanceof ArkAssignStmt && this.stmtIsCreateAddressObj(stmt)) {
            let obj: Obj | null = this.getObj(stmt);
            let LValue = stmt.getLeftOp();
            let csvar = this.ptrManager.getCSVar(LValue);
            if(obj != null) {
                this.addVarPointsTo(csvar, obj);
            }
        }
        else if(stmt.containsInvokeExpr() && stmt.getInvokeExpr() instanceof ArkStaticInvokeExpr) {
            let invokestmt = stmt as ArkInvokeStmt;
            let callee = this.resolveCall(invokestmt);
            if(callee != null) {
                this.addCallEdge(new CallEdge("staticinvoke",this.ptrManager.getCallSite(invokestmt)!,callee));
            }
        }
        else if(stmt instanceof ArkAssignStmt && this.isCopyStmt(stmt)) {
            let lhs = stmt.getLeftOp();
            let rhs = stmt.getRightOp();
            this.addPFGEdge(new PointerFlowEdge(this.ptrManager.getCSVar(rhs),this.ptrManager.getCSVar(lhs)));
        }
        else if(stmt instanceof ArkAssignStmt && stmt.getLeftOp() instanceof Local && stmt.getRightOp() instanceof Constant) {
            let obj: Obj | null = this.getObj(stmt);
            let LValue = stmt.getLeftOp();
            let csvar = this.ptrManager.getCSVar(LValue);
            if(obj != null) {
                this.addVarPointsTo(csvar, obj);
            }
        }
        else if(stmt.containsFieldRef() && stmt instanceof ArkAssignStmt) {
            if(this.isStaticFieldLoadStmt(stmt as ArkAssignStmt)) {
                let lhs = stmt.getLeftOp();
                let f = stmt.getFieldRef() as ArkStaticFieldRef;
                this.addPFGEdge(new PointerFlowEdge(this.ptrManager.getStaticField(f),this.ptrManager.getCSVar(lhs)));
            }
            if(this.isStaticFieldStoreStmt(stmt as ArkAssignStmt)){
                let rhs = stmt.getRightOp();
                let f = stmt.getFieldRef() as ArkStaticFieldRef;
                this.addPFGEdge(new PointerFlowEdge(this.ptrManager.getCSVar(rhs),this.ptrManager.getStaticField(f)));
            }
        }
        else if(stmt instanceof ArkAssignStmt && stmt.getRightOp() instanceof AbstractBinopExpr){
            let lhs = (stmt as ArkAssignStmt).getLeftOp();
            let rhs = (stmt as ArkAssignStmt).getRightOp() as AbstractBinopExpr;
            this.addPFGEdge(new PointerFlowEdge(this.ptrManager.getCSVar(rhs.getOp1()),this.ptrManager.getCSVar(lhs)));
            this.addPFGEdge(new PointerFlowEdge(this.ptrManager.getCSVar(rhs.getOp2()),this.ptrManager.getCSVar(lhs)));
        }
    }
    isStaticFieldLoadStmt(stmt: ArkAssignStmt) : boolean {
        let rhs = stmt.getRightOp();
        if(rhs instanceof ArkStaticFieldRef) {
            return true;
        }
        return false;
    }
    isStaticFieldStoreStmt(stmt: ArkAssignStmt) : boolean {
        let lhs = stmt.getLeftOp();
        if(lhs instanceof ArkStaticFieldRef) {
            return true;
        }
        return false;
    }
    isCopyStmt(stmt: ArkAssignStmt) {
        let l = stmt.getLeftOp();
        let r = stmt.getRightOp();
        if(l instanceof Local && r instanceof Local) {
            return true;
        }
        return false;
    }
    addCallEdge(edge: CallEdge) {
        this.worklist.addcallEdge(edge);
    }
    resolveCall(stmt: ArkInvokeStmt) : ArkMethod | null {
        if(stmt.getInvokeExpr() instanceof ArkStaticInvokeExpr) {
            let invokeExpr = stmt.getInvokeExpr();
            let method : ArkMethod | null = this.scene.getMethod(invokeExpr.getMethodSignature());
            return method;
        }
        return null;
    }
    addVarPointsTo(csvar: CSVar, o: Obj) {
        this.addObjTo(csvar as Pointer, o);
        
    }
    addObjTo(pointer: Pointer, o: Obj) {
        let pts = new PointsToSet(new Set([o]));
        this.worklist.addpointerEntry(pointer,pts);
    }
    addPointsTo(pointer: Pointer, pts: PointsToSet) {
        this.worklist.addpointerEntry(pointer,pts);
    }
    getObj(stmt: ArkAssignStmt): Obj | null {
        let r = stmt.getRightOp();
        if(r instanceof ArkNewExpr) {
            return new NewObj(stmt);
        }
        if(r instanceof StringConstant) {
            return new StrConObj(stmt);
        }
        if(r instanceof NumberConstant) {
            return new NumberConObj(stmt);
        }
        if(r instanceof ArkNewArrayExpr) {
            return new ArrayObj(stmt);
        }
        return null;
    }
    stmtIsCreateAddressObj(stmt: ArkAssignStmt): boolean {
        let lhOp = stmt.getLeftOp();
        let rhOp = stmt.getRightOp();
        if ((rhOp instanceof ArkNewExpr || rhOp instanceof ArkNewArrayExpr) || 
            (lhOp instanceof Local && (
                (rhOp instanceof Local && rhOp.getType() instanceof FunctionType &&
                    rhOp.getDeclaringStmt() === null) ||
                (rhOp instanceof AbstractFieldRef && rhOp.getType() instanceof FunctionType))) || 
            (rhOp instanceof Local && rhOp.getName() === GLOBAL_THIS && rhOp.getDeclaringStmt() == null)
        ) {
            return true;
        }

        // TODO: add other Address Obj creation
        // like static object
        return false;
    }
}

