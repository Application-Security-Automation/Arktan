import { NumberConstant, StringConstant } from "../../Arkanalyzer/core/base/Constant";
import { ArkNewArrayExpr } from "../../Arkanalyzer/core/base/Expr";
import { ArkAssignStmt, ArkReturnStmt, Stmt} from "../../Arkanalyzer/core/base/Stmt";
import { ArrayType, FunctionType, Type } from "../../Arkanalyzer/core/base/Type";
import { MethodSignature } from "../../Arkanalyzer/core/model/ArkSignature";



export interface Obj{
    getType(): any;
}
export class NewObj implements Obj{
    private New: ArkAssignStmt;
    constructor(NewStmt: ArkAssignStmt) {
        this.New = NewStmt;
    }
    getNewStmt() {
        return this.New;
    }
    public getType() : Type {
        return this.New.getRightOp().getType();
    }
    public toString(): string {
        return "NewObj{"+ this.New.getRightOp().getType().toString() +"}";
    }
}
export class ParamObj implements Obj {
    private stmt: ArkAssignStmt;
    constructor(s: ArkAssignStmt) {
        this.stmt = s;
    }
    public getType() : Type {
        return this.stmt.getRightOp().getType();
    }
    public toString(): string {
        return "ParamObj{"+ this.stmt.getRightOp().getType().toString() +"}";
    }
}
export class StrConObj implements Obj {
    private stmt: ArkAssignStmt;
    constructor(s: ArkAssignStmt) {
        this.stmt = s;
    }
    public getType() : Type {
        return this.stmt.getRightOp().getType();
    }
    public toString(): string {
        return "StrConObj{"+ this.stmt.getRightOp().getType().toString() +"}";
    }
    public getContant() : string {
        return (this.stmt.getRightOp() as StringConstant).getValue();
    }
}
export class NumberConObj implements Obj {
    private stmt: ArkAssignStmt;
    constructor(s: ArkAssignStmt) {
        this.stmt = s;
    }
    public getType() : Type {
        return this.stmt.getRightOp().getType();
    }
    public toString(): string {
        return "NumberConObj{"+ this.stmt.getRightOp().getType().toString() +"}";
    }
    public getContant() : string {
        return (this.stmt.getRightOp() as NumberConstant).getValue();
    }
}
export class ArrayObj implements Obj {
    private newarray: ArkAssignStmt;
    private type: ArrayType;
    constructor(s: ArkAssignStmt) {
        this.newarray = s;
        this.type = s.getRightOp().getType() as ArrayType;
    }
    public getNewArrayExpr() : ArkNewArrayExpr {
        return this.newarray.getRightOp() as ArkNewArrayExpr;
    }
    public getType() : ArrayType {
        return this.type;
    }
    public setType(arrtype: ArrayType) {
        this.type = arrtype;
    }
    public toString(): string {
        return "ArrayObj{"+ this.type.toString() +"}";
    }
}
export class TaintObj implements Obj {
    private sourcepoint : string;
    private type : Type;
    constructor(sourcepoint : string, type : Type) {
        this.sourcepoint = sourcepoint;
        this.type = type;
    }
    getSourcePoint() : string {
        return this.sourcepoint;
    }
    getType() : Type {
        return this.type;
    }
    
}
export class FunctionObj implements Obj {
    private stmt : Stmt;
    private type : FunctionType;
    constructor(s : Stmt) {
        this.stmt = s;
        if(s instanceof ArkAssignStmt)
            this.type = s.getRightOp().getType() as FunctionType;
        else
            this.type = (s as ArkReturnStmt).getOp().getType() as FunctionType;
    }
    getType() {
        return this.type;
    }
    getStmt() : Stmt {
        return this.stmt;
    }
    getMethodSignature() : MethodSignature {
        return this.type.getMethodSignature()
    }
}