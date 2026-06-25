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

import { TypeInference } from '../common/TypeInference';
import { BasicBlock } from '../graph/BasicBlock';
import { ArkClass, ClassCategory } from '../model/ArkClass';
import { MethodSignature, MethodSubSignature } from '../model/ArkSignature';
import { Local } from './Local';
import {
    AliasType,
    AnnotationNamespaceType,
    ArrayType,
    BooleanType,
    ClassType,
    FunctionType,
    GenericType,
    NullType,
    NumberType,
    StringType,
    Type,
    UnclearReferenceType,
    UndefinedType,
    UnionType,
    UnknownType,
} from './Type';
import { Value } from './Value';
import { AbstractFieldRef, AbstractRef, ArkParameterRef } from './Ref';
import { ModelUtils } from '../common/ModelUtils';
import { ArkAssignStmt } from './Stmt';
import Logger, { LOG_MODULE_TYPE } from '../../utils/logger';
import { Scene } from '../../Scene';
import { ArkBody } from '../model/ArkBody';
import { EMPTY_STRING, ValueUtil } from '../common/ValueUtil';
import { ArkMethod } from '../model/ArkMethod';
import { ImportInfo } from '../model/ArkImport';
import { Constant } from './Constant';
import { ALL, CONSTRUCTOR_NAME, IMPORT } from '../common/TSConst';
import { Builtin } from '../common/Builtin';
import { COMPONENT_CREATE_FUNCTION, COMPONENT_POP_FUNCTION } from '../common/EtsConst';

const logger = Logger.getLogger(LOG_MODULE_TYPE.ARKANALYZER, 'Expr');

/**
 * @category core/base/expr
 */
export abstract class AbstractExpr implements Value {
    taintSrc!: string;
    isTaint: boolean = false;
    abstract getUses(): Value[];

    abstract getType(): Type;

    abstract toString(): string;

    public inferType(arkClass: ArkClass): AbstractExpr {
        return this;
    }
}

export abstract class AbstractInvokeExpr extends AbstractExpr {
    private methodSignature: MethodSignature;
    private args: Value[];
    private realGenericTypes?: Type[];//新增

    constructor(methodSignature: MethodSignature, args: Value[], realGenericTypes?: Type[]) {
        super();
        this.methodSignature = methodSignature;
        this.args = args;
        this.realGenericTypes = realGenericTypes;
    }

    /**
     * Get method Signature. The method signature is consist of ClassSignature and MethodSubSignature. 
     * It is the unique flag of a method. It is usually used to compose a expression string in ArkIRTransformer.
     * @returns The class method signature, such as ArkStaticInvokeExpr.
     * @example
     * 1. 3AC information composed of getMethodSignature ().

    ```typescript
    let strs: string[] = [];
    strs.push('staticinvoke <');
    strs.push(this.getMethodSignature().toString());
    strs.push('>(');
    ```
     */
    public getMethodSignature(): MethodSignature {
        return this.methodSignature;
    }

    public setMethodSignature(newMethodSignature: MethodSignature): void {
        this.methodSignature = newMethodSignature;
    }

    /**
     * Returns an argument used in the expression according to its index.
     * @param index - the index of the argument.
     * @returns An argument used in the expression.
     */
    public getArg(index: number): Value {
        return this.args[index];
    }

    /**
     * Returns an **array** of arguments used in the expression.
     * @returns An **array** of arguments used in the expression.
     * @example
     * 1. get args number.

    ```typescript
    const argsNum = expr.getArgs().length;
    if (argsNum < 5) {
        ... ...
    }
    ```

    2. iterate arg based on expression

    ```typescript
    for (const arg of this.getArgs()) {
        strs.push(arg.toString());
        strs.push(', ');
    }
    ```
     */
    public getArgs(): Value[] {
        return this.args;
    }

    public setArgs(newArgs: Value[]): void {
        this.args = newArgs;
    }

    public getType(): Type {
        let type = this.methodSignature.getType();
        if (!this.realGenericTypes) {
            return type;
        }
        if (type instanceof GenericType) {
            const realType = this.realGenericTypes[type.getIndex()];
            if (realType) {
                type = realType;
            }
        } else if (type instanceof UnionType) {
            const types: Type[] = [];
            type.getTypes().forEach(t => {
                let realType;
                if (t instanceof GenericType) {
                    realType = this.realGenericTypes?.[t.getIndex()];
                }
                types.push(realType ?? t);
            });
            type = new UnionType(types, type.getCurrType());
        }
        return type;
    }

    public getRealGenericTypes(): Type[] | undefined {
        return this.realGenericTypes;
    }

    public getUses(): Value[] {
        let uses: Value[] = [];
        uses.push(...this.args);
        for (const arg of this.args) {
            uses.push(...arg.getUses());
        }
        return uses;
    }
}

export class ArkInstanceInvokeExpr extends AbstractInvokeExpr {
    private base: Local;

    constructor(base: Local, methodSignature: MethodSignature, args: Value[], realGenericTypes?: Type[]) {
        super(methodSignature, args, realGenericTypes);
        this.base = base;
    }

    /**
     * Returns the local of the instance of invoke expression.
     * @returns The local of the invoke expression's instance..
     */
    public getBase(): Local {
        return this.base;
    }

    public setBase(newBase: Local): void {
        this.base = newBase;
    }

    /**
     * Returns an **array** of values used in this invoke expression, 
     * including all arguments and values each arguments used. 
     * For {@link ArkInstanceInvokeExpr}, the return also contains the caller base and uses of base.
     * @returns An **array** of arguments used in the invoke expression. 
     */
    public getUses(): Value[] {
        let uses: Value[] = [];
        uses.push(this.base);
        uses.push(...this.base.getUses());
        uses.push(...this.getArgs());
        for (const arg of this.getArgs()) {
            uses.push(...arg.getUses());
        }
        return uses;
    }

    public toString(): string {
        let strs: string[] = [];
        strs.push('instanceinvoke ');
        strs.push(this.base.toString());
        strs.push('.<');
        strs.push(this.getMethodSignature().toString());
        strs.push('>(');
        if (this.getArgs().length > 0) {
            for (const arg of this.getArgs()) {
                strs.push(arg.toString());
                strs.push(', ');
            }
            strs.pop();
        }
        strs.push(')');
        return strs.join('');
    }

    public inferType(arkClass: ArkClass): AbstractInvokeExpr {
        this.getArgs().forEach(arg => TypeInference.inferValueType(arg, arkClass));
        let baseType: Type | null = this.base.getType();
        if (this.base instanceof Local && baseType instanceof UnknownType) {
            baseType = TypeInference.inferBaseType(this.base.getName(), arkClass);
        } else if (baseType instanceof UnclearReferenceType) {
            baseType = TypeInference.inferUnclearReferenceType(baseType.getName(), arkClass);
        }
        const methodName = this.getMethodSignature().getMethodSubSignature().getMethodName();
        if (!baseType) {
            if (!this.tryInferFormGlobal(methodName, arkClass)) {
                logger.warn('infer ArkInstanceInvokeExpr base type fail: ' + this.toString());
            }
            return this;
        }
        if (this.base instanceof Local) {
            this.base.setType(baseType);
        }

        const scene = arkClass.getDeclaringArkFile().getScene();
        if ((methodName === 'forEach') && (baseType instanceof ArrayType)) {
            this.processForEach(baseType, scene);
        }
        TypeInference.inferRealGenericTypes(this.getRealGenericTypes(), arkClass);
        let result;

        if (baseType instanceof AliasType) {
            baseType = baseType.getOriginalType();
        }
        if (baseType instanceof UnionType) {
            for (const type of baseType.getTypes()) {
                result = this.inferMethod(type, methodName, scene);
                if (result) {
                    break;
                }
            }
        } else {
            result = this.inferMethod(baseType, methodName, scene);
        }
        if (!result && this.tryInferFormGlobal(methodName, arkClass)) {
            result = this;
        }
        if (result) {
            return result;
        }
        logger.warn('invoke ArkInstanceInvokeExpr MethodSignature type fail: ', this.toString());
        return this;
    }

    private processForEach(baseType: Type | ArrayType, scene: Scene): void {
        const arg = this.getArg(0);
        if (arg.getType() instanceof FunctionType) {
            const argMethodSignature = (arg.getType() as FunctionType).getMethodSignature();
            const argMethod = scene.getMethod(argMethodSignature);
            if (argMethod != null && argMethod.getBody()) {
                const body = argMethod.getBody() as ArkBody;
                const firstStmt = body.getCfg().getStartingStmt();
                if ((firstStmt instanceof ArkAssignStmt) && (firstStmt.getRightOp() instanceof ArkParameterRef)) {
                    const parameterRef = firstStmt.getRightOp() as ArkParameterRef;
                    parameterRef.setType((baseType as ArrayType).getBaseType());
                }
                TypeInference.inferTypeInMethod(argMethod);
            }
        } else {
            logger.warn(`arg of forEach must be callable`);
        }
    }

    private tryInferFormGlobal(methodName: string, arkClass: ArkClass) {
        if (arkClass.hasComponentDecorator() || arkClass.getCategory() === ClassCategory.OBJECT) {
            const global = arkClass.getDeclaringArkFile().getScene().getSdkGlobal(methodName);
            if (global instanceof ArkMethod) {
                TypeInference.inferMethodReturnType(global);
                this.setMethodSignature(global.getSignature());
                return true;
            }
        }
        return false;
    }

    private inferMethod(baseType: Type, methodName: string, scene: Scene): AbstractInvokeExpr | null {
        if (baseType instanceof ClassType) {
            const arkClass = scene.getClass(baseType.getClassSignature());
            const method = arkClass ? ModelUtils.findPropertyInClass(methodName, arkClass) : null;
            if (method instanceof ArkMethod) {
                TypeInference.inferMethodReturnType(method);
                this.setMethodSignature(method.getSignature());
                if (method.isStatic()) {
                    return new ArkStaticInvokeExpr(method.getSignature(), this.getArgs(), this.getRealGenericTypes());
                }
                return this;
            } else if (methodName === CONSTRUCTOR_NAME) { //sdk隐式构造
                const subSignature = new MethodSubSignature(methodName, [],
                    new ClassType(baseType.getClassSignature()));
                const signature = new MethodSignature(baseType.getClassSignature(), subSignature);
                this.setMethodSignature(signature);
                return this;
            } else if (methodName === Builtin.ITERATOR_NEXT) { //sdk隐式构造
                const returnType = this.getMethodSignature().getMethodSubSignature().getReturnType();
                if (returnType instanceof ClassType && returnType.getClassSignature().getDeclaringFileSignature()
                    .getProjectName() === Builtin.DUMMY_PROJECT_NAME) {
                    returnType.setRealGenericTypes(baseType.getRealGenericTypes());
                    return this;
                }
            }
        } else if (baseType instanceof AnnotationNamespaceType) {
            const namespace = scene.getNamespace(baseType.getNamespaceSignature());
            if (namespace) {
                const foundMethod = ModelUtils.findPropertyInNamespace(methodName, namespace);
                if (foundMethod instanceof ArkMethod) {
                    TypeInference.inferMethodReturnType(foundMethod);
                    this.setMethodSignature(foundMethod.getSignature());
                    return new ArkStaticInvokeExpr(foundMethod.getSignature(), this.getArgs(), this.getRealGenericTypes());
                }
            }
        } else if (baseType instanceof ArrayType && methodName === Builtin.ITERATOR_FUNCTION) {
            const returnType = this.getMethodSignature().getMethodSubSignature().getReturnType();
            if (returnType instanceof ClassType && returnType.getClassSignature().getDeclaringFileSignature()
                .getProjectName() === Builtin.DUMMY_PROJECT_NAME) {
                returnType.setRealGenericTypes([baseType.getBaseType()]);
                return this;
            }
        }
        //处理string库方法-----------------------------------------------------------------
        else if(baseType instanceof StringType){
            let cls = scene.NativeClass.get("string");
            if(cls != undefined)
                for (const method of cls.getMethods()) {
                    if(method.getName() === methodName) {
                        TypeInference.inferMethodReturnType(method);
                        this.setMethodSignature(method.getSignature());
                        return this;
                    }
                }
        }
        //处理array库方法-----------------------------------------------------------------
        else if(baseType instanceof ArrayType){
            let cls = scene.NativeClass.get("array");
            if(cls != undefined)
                for (const method of cls.getMethods()) {
                    if(method.getName() === methodName) {
                        TypeInference.inferMethodReturnType(method);
                        this.setMethodSignature(method.getSignature());
                        return this;
                    }
                }
        }
        //处理map库方法-----------------------------------------------------------------
        if(baseType instanceof ClassType && baseType.toString() === "@%unk/%unk: Map"){
            let cls = scene.NativeClass.get("map");
            if(cls != undefined)
                for (const method of cls.getMethods()) {
                    if(method.getName() === methodName) {
                        TypeInference.inferMethodReturnType(method);
                        this.setMethodSignature(method.getSignature());
                        return this;
                    }
                }
        }
        //处理set库方法-----------------------------------------------------------------
        if(baseType instanceof ClassType && baseType.toString() === "@%unk/%unk: Set"){
            let cls = scene.NativeClass.get("set");
            if(cls != undefined)
                for (const method of cls.getMethods()) {
                    if(method.getName() === methodName) {
                        TypeInference.inferMethodReturnType(method);
                        this.setMethodSignature(method.getSignature());
                        return this;
                    }
            }
        }
        //处理json库方法-----------------------------------------------------------------
        if(baseType instanceof UnknownType && this.base.getName() === "JSON"){
            let cls = scene.NativeClass.get("json")!;
            for (const method of cls.getMethods()) {
                if(method.getName() === methodName) {
                    TypeInference.inferMethodReturnType(method);
                    this.setMethodSignature(method.getSignature());
                    return this;
                }
            }
        }
        //--------------------------------------------------------------------------------
        return null;
    }
}

export class ArkStaticInvokeExpr extends AbstractInvokeExpr {
    constructor(methodSignature: MethodSignature, args: Value[], realGenericTypes?: Type[]) {
        super(methodSignature, args, realGenericTypes);
    }

    public toString(): string {
        let strs: string[] = [];
        strs.push('staticinvoke <');
        strs.push(this.getMethodSignature().toString());
        strs.push('>(');
        if (this.getArgs().length > 0) {
            for (const arg of this.getArgs()) {
                strs.push(arg.toString());
                strs.push(', ');
            }
            strs.pop();
        }
        strs.push(')');
        return strs.join('');
    }

    public inferType(arkClass: ArkClass): ArkStaticInvokeExpr {
        this.getArgs().forEach(arg => TypeInference.inferValueType(arg, arkClass));
        const oldMethodSignature = this.getMethodSignature();
        const oldMethodSubSignature = oldMethodSignature.getMethodSubSignature();
        const methodName = oldMethodSubSignature.getMethodName();
        let method;
        const arkExport = ModelUtils.getStaticMethodWithName(methodName, arkClass)
            ?? ModelUtils.getArkExportInImportInfoWithName(methodName, arkClass.getDeclaringArkFile());
        if (arkExport instanceof ArkMethod) {
            method = arkExport;
        } else if (arkExport instanceof ArkClass) {
            method = arkExport.getMethodWithName(CONSTRUCTOR_NAME);
        }
        if (!method) {
            if (methodName === IMPORT && this.getArgs()[0] instanceof Constant) {
                const importInfo = new ImportInfo();
                importInfo.setNameBeforeAs(ALL);
                importInfo.setImportClauseName(ALL);
                importInfo.setImportFrom((this.getArgs()[0] as Constant).getValue());
                importInfo.setDeclaringArkFile(arkClass.getDeclaringArkFile());
                const type = TypeInference.parseArkExport2Type(importInfo.getLazyExportInfo()?.getArkExport());
                if (type) {
                    const subSignature = new MethodSubSignature(methodName, oldMethodSubSignature.getParameters(),
                        type);
                    const signature = new MethodSignature(oldMethodSignature.getDeclaringClassSignature(),
                        subSignature);
                    this.setMethodSignature(signature);
                }
                return this;
            }
            if (arkClass.hasComponentDecorator() || arkClass.getCategory() === ClassCategory.OBJECT) {
                let className;
                if (COMPONENT_CREATE_FUNCTION === methodName || COMPONENT_POP_FUNCTION === methodName) {
                    className = this.getMethodSignature().getDeclaringClassSignature().getClassName();
                }
                const globalName = className ?? methodName;
                const global = arkClass.getDeclaringArkFile().getScene().getSdkGlobal(globalName);
                if (global instanceof ArkMethod) {
                    method = global;
                } else if (global instanceof ArkClass) {
                    const callable = ModelUtils.findPropertyInClass(methodName, global);
                    if (callable instanceof ArkMethod) {
                        method = callable;
                    } else {
                        const signature = new MethodSignature(global.getSignature(), oldMethodSubSignature);
                        this.setMethodSignature(signature);
                    }
                }
            }
        }
        if (method) {
            this.setMethodSignature(method.getSignature());
            TypeInference.inferMethodReturnType(method);
        }
        return this;
    }
}

export class ArkPtrInvokeExpr extends AbstractInvokeExpr {
    private funPtrLocal: Local;

    constructor(methodSignature: MethodSignature, ptr: Local, args: Value[], realGenericTypes?: Type[]) {
        super(methodSignature, args, realGenericTypes);
        this.funPtrLocal = ptr;
    }

    public setFunPtrLocal(ptr: Local): void {
        this.funPtrLocal = ptr;
    }

    public getFuncPtrLocal(): Local {
        return this.funPtrLocal;
    }

    public toString(): string {
        let strs: string[] = [];
        strs.push('ptrinvoke <');
        strs.push(this.getMethodSignature().toString());
        strs.push('>(');
        if (this.getArgs().length > 0) {
            for (const arg of this.getArgs()) {
                strs.push(arg.toString());
                strs.push(', ');
            }
            strs.pop();
        }
        strs.push(')');
        return strs.join('');
    }

    public inferType(arkClass: ArkClass): ArkPtrInvokeExpr {
        // TODO: handle type inference
        return this;
    }
}

export class ArkNewExpr extends AbstractExpr {
    private classType: ClassType;

    constructor(classType: ClassType) {
        super();
        this.classType = classType;
    }

    public getClassType(): ClassType {
        return this.classType;
    }

    public getUses(): Value[] {
        return [];
    }

    public getType(): Type {
        return this.classType;
    }

    public toString(): string {
        return 'new ' + this.classType;
    }

    public inferType(arkClass: ArkClass): ArkNewExpr {
        const className = this.classType.getClassSignature().getClassName();
        const type = TypeInference.inferUnclearReferenceType(className, arkClass);
        if (type && type instanceof ClassType) {
            let realGenericTypes = this.classType.getRealGenericTypes();
            this.classType = realGenericTypes ? new ClassType(type.getClassSignature(), realGenericTypes) : type;
        }
        return this;
    }
}

export class ArkNewArrayExpr extends AbstractExpr {
    private baseType: Type;
    private size: Value;

    private fromLiteral: boolean;

    constructor(baseType: Type, size: Value, fromLiteral: boolean = false) {
        super();
        this.baseType = baseType;
        this.size = size;
        this.fromLiteral = fromLiteral;
    }

    public getSize(): Value {
        return this.size;
    }

    public setSize(newSize: Value): void {
        this.size = newSize;
    }

    public getType(): ArrayType {
        return new ArrayType(this.baseType, 1);
    }

    public getBaseType(): Type {
        return this.baseType;
    }

    public setBaseType(newType: Type): void {
        this.baseType = newType;
    }

    public isFromLiteral(): boolean {
        return this.fromLiteral;
    }

    public inferType(arkClass: ArkClass): ArkNewArrayExpr {
        const type = TypeInference.inferUnclearedType(this.baseType, arkClass);
        if (type) {
            this.baseType = type;
        }
        return this;
    }

    public getUses(): Value[] {
        let uses: Value[] = [this.size];
        uses.push(...this.size.getUses());
        return uses;
    }

    public toString(): string {
        return 'newarray (' + this.baseType + ')[' + this.size + ']';
    }
}

export class ArkDeleteExpr extends AbstractExpr {
    private field: AbstractFieldRef;

    constructor(field: AbstractFieldRef) {
        super();
        this.field = field;
    }

    public getField(): AbstractFieldRef {
        return this.field;
    }

    public setField(newField: AbstractFieldRef): void {
        this.field = newField;
    }

    public getType(): Type {
        return BooleanType.getInstance();
    }

    public getUses(): Value[] {
        const uses: Value[] = [];
        uses.push(this.field);
        uses.push(...this.field.getUses());
        return uses;
    }

    public toString(): string {
        return 'delete ' + this.field;
    }

}

export class ArkAwaitExpr extends AbstractExpr {
    private promise: Value;

    constructor(promise: Value) {
        super();
        this.promise = promise;
    }

    public getPromise(): Value {
        return this.promise;
    }

    public setPromise(newPromise: Value): void {
        this.promise = newPromise;
    }

    public getType(): Type {
        return this.promise.getType();
    }

    public inferType(arkClass: ArkClass): ArkAwaitExpr {
        TypeInference.inferValueType(this.promise, arkClass);
        return this;
    }

    public getUses(): Value[] {
        const uses: Value[] = [];
        uses.push(this.promise);
        uses.push(...this.promise.getUses());
        return uses;
    }

    public toString(): string {
        const str = 'await ' + this.promise;
        return str;
    }
}

export class ArkYieldExpr extends AbstractExpr {
    private yieldValue: Value;

    constructor(yieldValue: Value) {
        super();
        this.yieldValue = yieldValue;
    }

    public getYieldValue(): Value {
        return this.yieldValue;
    }

    public setYieldValue(newYieldValue: Value): void {
        this.yieldValue = newYieldValue;
    }

    public getType(): Type {
        return this.yieldValue.getType();
    }

    public getUses(): Value[] {
        const uses: Value[] = [];
        uses.push(this.yieldValue);
        uses.push(...this.yieldValue.getUses());
        return uses;
    }

    public toString(): string {
        const str = 'yield ' + this.yieldValue;
        return str;
    }
}

export enum NormalBinaryOperator {
    // TODO: unfold it
    NullishCoalescing = '??',

    // arithmetic
    Exponentiation = '**',
    Division = '/',
    Addition = '+',
    Subtraction = '-',
    Multiplication = '*',
    Remainder = '%',

    // shift
    LeftShift = '<<',
    RightShift = '>>',
    UnsignedRightShift = '>>>',

    // Bitwise
    BitwiseAnd = '&',
    BitwiseOr = '|',
    BitwiseXor = '^',

    // Logical
    LogicalAnd = '&&',
    LogicalOr = '||',
}

export enum RelationalBinaryOperator {
    LessThan = '<',
    LessThanOrEqual = '<=',
    GreaterThan = '>',
    GreaterThanOrEqual = '>=',
    Equality = '==',
    InEquality = '!=',
    StrictEquality = '===',
    StrictInequality = '!==',
}

export type BinaryOperator = NormalBinaryOperator | RelationalBinaryOperator;

// 二元运算表达式
export abstract class AbstractBinopExpr extends AbstractExpr {
    protected op1: Value;
    protected op2: Value;
    protected operator: BinaryOperator;

    protected type!: Type;

    constructor(op1: Value, op2: Value, operator: BinaryOperator) {
        super();
        this.op1 = op1;
        this.op2 = op2;
        this.operator = operator;
    }

    /**
     * Returns the first operand in the binary operation expression. 
     * For example, the first operand in `a + b;` is `a`.
     * @returns The first operand in the binary operation expression.
     */
    public getOp1(): Value {
        return this.op1;
    }

    public setOp1(newOp1: Value): void {
        this.op1 = newOp1;
    }

    /**
     * Returns the second operand in the binary operation expression. 
     * For example, the second operand in `a + b;` is `b`.
     * @returns The second operand in the binary operation expression.
     */
    public getOp2(): Value {
        return this.op2;
    }

    public setOp2(newOp2: Value): void {
        this.op2 = newOp2;
    }

    /**
     * Get the binary operator from the statement. 
     * The binary operator can be divided into two categories, 
     * one is the normal binary operator and the other is relational binary operator.
     * @returns The binary operator from the statement. 
     * @example
    ```typescript
    if (expr instanceof AbstractBinopExpr) {
        let op1: Value = expr.getOp1();
        let op2: Value = expr.getOp2();
        let operator: string = expr.getOperator();
        ... ...
    }
    ```
     */
    public getOperator(): BinaryOperator {
        return this.operator;
    }

    public getType(): Type {
        if (!this.type) {
            this.setType();
        }
        return this.type;
    }

    public getUses(): Value[] {
        let uses: Value[] = [];
        uses.push(this.op1);
        uses.push(...this.op1.getUses());
        uses.push(this.op2);
        uses.push(...this.op2.getUses());
        return uses;
    }

    public toString(): string {
        return this.op1 + ' ' + this.operator + ' ' + this.op2;
    }

    protected inferOpType(op: Value, arkClass: ArkClass) {
        if (op instanceof AbstractExpr || op instanceof AbstractRef) {
            TypeInference.inferValueType(op, arkClass);
        }
    }

    protected setType() {
        let op1Type = this.op1.getType();
        let op2Type = this.op2.getType();
        if (op1Type instanceof UnionType) {
            op1Type = op1Type.getCurrType();
        }
        if (op2Type instanceof UnionType) {
            op2Type = op2Type.getCurrType();
        }
        let type = UnknownType.getInstance();
        switch (this.operator) {
            case '+':
                if (op1Type === StringType.getInstance() || op2Type === StringType.getInstance()) {
                    type = StringType.getInstance();
                }
                if (op1Type === NumberType.getInstance() && op2Type === NumberType.getInstance()) {
                    type = NumberType.getInstance();
                }
                break;
            case '-':
            case '*':
            case '/':
            case '%':
                if (op1Type === NumberType.getInstance() && op2Type === NumberType.getInstance()) {
                    type = NumberType.getInstance();
                }
                break;
            case '!=':
            case '!==':
            case '<':
            case '>':
            case '<=':
            case '>=':
            case '&&':
            case '||':
            case '==':
            case '===':
                type = BooleanType.getInstance();
                break;
            case '&':
            case '|':
            case '^':
            case '<<':
            case '>>':
            case '>>>':
                if (op1Type === NumberType.getInstance() && op2Type === NumberType.getInstance()) {
                    type = NumberType.getInstance();
                }
                break;
            case '??':
                if (op1Type === UnknownType.getInstance() || op1Type === UndefinedType.getInstance()
                    || op1Type === NullType.getInstance()) {
                    type = op2Type;
                } else {
                    type = op1Type;
                }
                break;
            default:
                ;
        }
        this.type = type;
    }

    public inferType(arkClass: ArkClass): AbstractBinopExpr {
        this.inferOpType(this.op1, arkClass);
        this.inferOpType(this.op2, arkClass);
        this.setType();
        return this;
    }
}

export class ArkConditionExpr extends AbstractBinopExpr {
    constructor(op1: Value, op2: Value, operator: RelationalBinaryOperator) {
        super(op1, op2, operator);
    }

    public inferType(arkClass: ArkClass): ArkConditionExpr {
        this.inferOpType(this.op1, arkClass);
        const op1Type = this.op1.getType();
        if (this.operator === RelationalBinaryOperator.InEquality && this.op2 === ValueUtil.getOrCreateNumberConst(0)) {
            if (op1Type instanceof StringType) {
                this.op2 = ValueUtil.createStringConst(EMPTY_STRING);
            } else if (op1Type instanceof BooleanType) {
                this.op2 = ValueUtil.getBooleanConstant(false);
            } else if (op1Type instanceof ClassType) {
                this.op2 = ValueUtil.getUndefinedConst();
            }
        } else {
            this.inferOpType(this.getOp2(), arkClass);
        }
        this.type = BooleanType.getInstance();
        return this;
    }
}

export class ArkNormalBinopExpr extends AbstractBinopExpr {
    constructor(op1: Value, op2: Value, operator: NormalBinaryOperator) {
        super(op1, op2, operator);
    }
}

export class ArkTypeOfExpr extends AbstractExpr {
    private op: Value;

    constructor(op: Value) {
        super();
        this.op = op;
    }

    public getOp(): Value {
        return this.op;
    }

    public setOp(newOp: Value): void {
        this.op = newOp;
    }

    public getUses(): Value[] {
        let uses: Value[] = [];
        uses.push(this.op);
        uses.push(...this.op.getUses());
        return uses;
    }

    public getType(): Type {
        return StringType.getInstance();
    }

    public toString(): string {
        return 'typeof ' + this.op;
    }
}

export class ArkInstanceOfExpr extends AbstractExpr {
    private op: Value;
    private checkType: Type;

    constructor(op: Value, checkType: Type) {
        super();
        this.op = op;
        this.checkType = checkType;
    }

    public getOp(): Value {
        return this.op;
    }

    public setOp(newOp: Value): void {
        this.op = newOp;
    }

    public getCheckType(): Type {
        return this.checkType;
    }

    public getType(): Type {
        return BooleanType.getInstance();
    }

    public getUses(): Value[] {
        let uses: Value[] = [];
        uses.push(this.op);
        uses.push(...this.op.getUses());
        return uses;
    }

    public toString(): string {
        return this.op + ' instanceof ' + this.checkType;
    }
}

// 类型转换
export class ArkCastExpr extends AbstractExpr {
    private op: Value;
    private type: Type;

    constructor(op: Value, type: Type) {
        super();
        this.op = op;
        this.type = type;
    }

    public getOp(): Value {
        return this.op;
    }

    public setOp(newOp: Value): void {
        this.op = newOp;
    }

    public getUses(): Value[] {
        let uses: Value[] = [];
        uses.push(this.op);
        uses.push(...this.op.getUses());
        return uses;
    }

    public getType(): Type {
        return this.type;
    }

    public inferType(arkClass: ArkClass): AbstractExpr {
        const type = TypeInference.inferUnclearedType(this.type, arkClass) ?? this.op.getType();
        if (!TypeInference.isUnclearType(type)) {
            this.type = type;
        }
        return this;
    }

    public toString(): string {
        return '<' + this.type + '>' + this.op;
    }
}

export class ArkPhiExpr extends AbstractExpr {
    private args: Local[];
    private argToBlock: Map<Local, BasicBlock>;

    constructor() {
        super();
        this.args = [];
        this.argToBlock = new Map();
    }

    public getUses(): Value[] {
        let uses: Value[] = [];
        uses.push(...this.args);
        return uses;
    }

    public getArgs(): Local[] {
        return this.args;
    }

    public setArgs(args: Local[]): void {
        this.args = args;
    }

    public getArgToBlock(): Map<Local, BasicBlock> {
        return this.argToBlock;
    }

    public setArgToBlock(argToBlock: Map<Local, BasicBlock>): void {
        this.argToBlock = argToBlock;
    }

    public getType(): Type {
        return this.args[0].getType();
    }

    public toString(): string {
        let strs: string[] = [];
        strs.push('phi(');
        if (this.args.length > 0) {
            for (const arg of this.args) {
                strs.push(arg.toString());
                strs.push(', ');
            }
            strs.pop();
        }
        strs.push(')');
        return strs.join('');
    }
}

export enum UnaryOperator {
    Neg = '-',
    BitwiseNot = '~',
    LogicalNot = '!'
}

// unary operation expression
export class ArkUnopExpr extends AbstractExpr {
    private op: Value;
    private operator: UnaryOperator;

    constructor(op: Value, operator: UnaryOperator) {
        super();
        this.op = op;
        this.operator = operator;
    }

    public getUses(): Value[] {
        let uses: Value[] = [];
        uses.push(this.op);
        uses.push(...this.op.getUses());
        return uses;
    }

    public getOp(): Value {
        return this.op;
    }

    public getType(): Type {
        return this.op.getType();
    }

    /**
     * Get the unary operator from the statement, such as `-`,`~`,`!`.
     * @returns the unary operator of a statement.
     */
    public getOperator(): UnaryOperator {
        return this.operator;
    }

    public toString(): string {
        return this.operator + this.op;
    }
}
