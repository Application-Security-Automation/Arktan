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

import { ArkParameterRef, ArkThisRef } from '../base/Ref';
import { ArkAssignStmt, ArkReturnStmt, Stmt } from '../base/Stmt';
import { GenericType } from '../base/Type';
import { Value } from '../base/Value';
import { Cfg } from '../graph/Cfg';
import { ViewTree } from '../graph/ViewTree';
import { ArkBody } from './ArkBody';
import { ArkClass } from './ArkClass';
import { MethodSignature } from './ArkSignature';
import { BodyBuilder } from '../common/BodyBuilder';
import { ArkExport, ExportType } from './ArkExport';
import { ANONYMOUS_METHOD_PREFIX, DEFAULT_ARK_METHOD_NAME } from '../common/Const';
import { getColNo, getLineNo, LineCol, setCol, setLine } from '../base/Position';
import { ArkBaseModel } from './ArkBaseModel';
import { ArkError } from '../common/ArkError';

export const arkMethodNodeKind = ['MethodDeclaration', 'Constructor', 'FunctionDeclaration', 'GetAccessor',
    'SetAccessor', 'ArrowFunction', 'FunctionExpression', 'MethodSignature', 'ConstructSignature', 'CallSignature'];

/**
 * @category core/model
 */
export class ArkMethod extends ArkBaseModel implements ArkExport {
    private code?: string;
    private lineCol: LineCol = 0;

    private declaringArkClass!: ArkClass;

    private genericTypes?: GenericType[];

    private methodSignature!: MethodSignature[];

    private body?: ArkBody;
    private viewTree?: ViewTree;

    private bodyBuilder?: BodyBuilder;

    private isGeneratedFlag: boolean = false;
    private asteriskToken: boolean = false;

    constructor() {
        super();
    }

    getExportType(): ExportType {
        return ExportType.METHOD;
    }

    public getName() {
        return this.getSignature().getMethodSubSignature().getMethodName();
    }

    /**
     * Returns the codes of method as a **string.**
     * @returns the codes of method.
     */
    public getCode() {
        return this.code;
    }

    public setCode(code: string) {
        this.code = code;
    }

    public getLine() {
        return getLineNo(this.lineCol);
    }

    public setLine(line: number) {
        this.lineCol = setLine(this.lineCol, line);
    }

    public getColumn() {
        return getColNo(this.lineCol);
    }

    public setColumn(column: number) {
        this.lineCol = setCol(this.lineCol, column);
    }

    /**
     * Returns the declaring class of the method.
     * @returns The declaring class of the method.
     */
    public getDeclaringArkClass() {
        return this.declaringArkClass;
    }

    public setDeclaringArkClass(declaringArkClass: ArkClass) {
        this.declaringArkClass = declaringArkClass;
    }

    public getDeclaringArkFile() {
        return this.declaringArkClass.getDeclaringArkFile();
    }

    public isDefaultArkMethod(): boolean {
        return this.getName() === DEFAULT_ARK_METHOD_NAME;
    }

    public isAnonymousMethod(): boolean {
        return this.getName().startsWith(ANONYMOUS_METHOD_PREFIX);
    }

    public getParameters() {
        return this.getSignature().getMethodSubSignature().getParameters();
    }

    public getReturnType() {
        return this.getSignature().getType();
    }

    /**
     * <font color="red">?建议明确返回类型？</font>
     * Get the method signature. It includes two fields. one is ClassSignature, 
     * the other is MethodSubSignature. The former indicates what class this method belong to, 
     * the latter indicates the detail info of this method, 
     * such as method name, parameters, returnType, etc.
     * @returns The method signature.
     * @example
     * 1. New a body.

    ```typescript
    let mtd = new ArkMethod();
    // ... ...
    let mtd = mtd.getSignature();
    // ... ...
    ```
     */
    public getSignature(): MethodSignature {
        return this.methodSignature[0];
    }

    public getAllSignature(): MethodSignature[] {
        return this.methodSignature;
    }

    public setSignature(methodSignature: MethodSignature | MethodSignature[]) {
        if (Array.isArray(methodSignature)) {
            this.methodSignature = methodSignature;
        } else {
            this.methodSignature = [methodSignature];
        }
    }

    public getSubSignature() {
        return this.getSignature().getMethodSubSignature();
    }

    public getGenericTypes(): GenericType[] | undefined {
        return this.genericTypes;
    }

    public isGenericsMethod(): boolean {
        return this.genericTypes !== undefined;
    }

    public setGenericTypes(genericTypes: GenericType[]): void {
        this.genericTypes = genericTypes;
    }

    public getBodyBuilder(): BodyBuilder | undefined {
        return this.bodyBuilder;
    }

    /**
     * Get {@link ArkBody} of a Method.
     * A {@link ArkBody} contains the CFG and actual instructions or operations to be executed for a method. 
     * It is analogous to the body of a function or method in high-level programming languages, 
     * which contains the statements and expressions that define what the function does.
     * @returns The {@link ArkBody} of a method.
     * @example
     * 1. Get cfg or stmt through ArkBody.

    ```typescript
    let cfg = this.scene.getMethod()?.getBody().getCfg();
    const body = arkMethod.getBody()
    ```

    2. Get local variable through ArkBody.

    ```typescript
    arkClass.getDefaultArkMethod()?.getBody().getLocals.forEach(local=>{...})
    let locals = arkFile().getDefaultClass().getDefaultArkMethod()?.getBody()?.getLocals();
    ```
     */
    public getBody(): ArkBody | undefined {
        return this.body;
    }

    public setBody(body: ArkBody) {
        this.body = body;
    }

    /**
     * Get the CFG (i.e., control flow graph) of a method. 
     * The CFG is a graphical representation of all possible control flow paths within a method's body.
     * A CFG consists of blocks, statements and goto control jumps.
     * @returns The CFG (i.e., control flow graph) of a method. 
     * @example
     * 1. get stmt through ArkBody cfg.

    ```typescript
    body = arkMethod.getBody();
    const cfg = body.getCfg();
    for (const threeAddressStmt of cfg.getStmts()) {
    ... ...
    }
    ```

    2. get blocks through ArkBody cfg.

    ```typescript
    const body = arkMethod.getBody();
    const blocks = [...body.getCfg().getBlocks()];
    for (let i=0; i<blocks.length; i++) {
    const block = blocks[i];
    ... ...
    for (const stmt of block.getStmts()) {
        ... ...
    }
    let text = "next;"
    for (const next of block.getSuccessors()) {
        text += blocks.indexOf(next) + ' ';
    }
    // ... ...
    }
    ```
     */
    public getCfg(): Cfg | undefined {
        return this.body?.getCfg();
    }

    public getOriginalCfg(): Cfg | undefined {
        return undefined;
    }

    public getParameterInstances(): Value[] {
        // 获取方法体中参数Local实例
        let stmts: Stmt[] = [];
        if (this.getCfg()) {
            const cfg = this.getCfg() as Cfg;
            stmts.push(...cfg.getStmts());
        }
        let results: Value[] = [];
        for (let stmt of stmts) {
            if (stmt instanceof ArkAssignStmt) {
                if (stmt.getRightOp() instanceof ArkParameterRef) {
                    results.push((stmt as ArkAssignStmt).getLeftOp());
                }
            }
            if (results.length === this.getParameters().length) {
                return results;
            }
        }
        return results;
    }

    public getThisInstance(): Value | null {
        // 获取方法体中This实例
        let stmts: Stmt[] = [];
        if (this.getCfg()) {
            const cfg = this.getCfg() as Cfg;
            stmts.push(...cfg.getStmts());
        }
        for (let stmt of stmts) {
            if (stmt instanceof ArkAssignStmt) {
                if (stmt.getRightOp() instanceof ArkThisRef) {
                    return stmt.getLeftOp();
                }
            }
        }
        return null;
    }

    public getReturnValues(): Value[] {
        // 获取方法体中return值实例
        let resultValues: Value[] = [];
        let stmts: Stmt[] = [];
        if (this.getCfg()) {
            const cfg = this.getCfg() as Cfg;
            stmts.push(...cfg.getStmts());
        }
        for (let stmt of stmts) {
            if (stmt instanceof ArkReturnStmt) {
                resultValues.push(stmt.getOp());
            }
        }
        return resultValues;
    }

    public getReturnStmt(): Stmt[] {
        return this.getCfg()!.getStmts().filter(stmt => stmt instanceof ArkReturnStmt);
    }

    public setViewTree(viewTree: ViewTree) {
        this.viewTree = viewTree;
    }

    public getViewTree(): ViewTree | undefined {
        return this.viewTree;
    }

    public hasViewTree(): boolean {
        return this.viewTree !== undefined;
    }

    public setBodyBuilder(bodyBuilder: BodyBuilder) {
        this.bodyBuilder = bodyBuilder;
        if (this.getDeclaringArkFile().getScene().buildClassDone()) {
            this.buildBody();
        }
    }

    public buildBody() {
        if (this.bodyBuilder) {
            const arkBody: ArkBody | null = this.bodyBuilder.build();
            if (arkBody) {
                this.setBody(arkBody);
                arkBody.getCfg().setDeclaringMethod(this);

            }
            this.bodyBuilder = undefined;
        }
    }

    public isGenerated(): boolean {
        return this.isGeneratedFlag;
    }

    public setIsGeneratedFlag(isGeneratedFlag: boolean) {
        this.isGeneratedFlag = isGeneratedFlag;
    }

    public getAsteriskToken(): boolean {
        return this.asteriskToken;
    }

    public setAsteriskToken(asteriskToken: boolean) {
        this.asteriskToken = asteriskToken;
    }

    public validate(): ArkError {
        return this.validateFields(['declaringArkClass', 'methodSignature']);
    }
}