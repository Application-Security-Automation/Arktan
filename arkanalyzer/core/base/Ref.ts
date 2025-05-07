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

import Logger, { LOG_MODULE_TYPE } from '../../utils/logger';
import { BaseSignature, FieldSignature } from '../model/ArkSignature';
import { Local } from './Local';
import { AnnotationNamespaceType, ArrayType, ClassType, Type, UnclearReferenceType, UnknownType } from './Type';
import { Value } from './Value';
import { ArkClass, ClassCategory } from '../model/ArkClass';
import { TypeInference } from '../common/TypeInference';
import { ValueUtil } from '../common/ValueUtil';
import { ArkField } from '../model/ArkField';
import { ArkMethod } from '../model/ArkMethod';
import { ANONYMOUS_CLASS_DELIMITER, ANONYMOUS_CLASS_PREFIX, DEFAULT_ARK_CLASS_NAME } from '../common/Const';

const logger = Logger.getLogger(LOG_MODULE_TYPE.ARKANALYZER, 'Ref');

/**
 * @category core/base/ref
 */
export abstract class AbstractRef implements Value {
    taintSrc!: string;
    isTaint: boolean = false;
    abstract getUses(): Value[];

    abstract getType(): Type;

    public inferType(arkClass: ArkClass): AbstractRef {
        return this;
    }
}

export class ArkArrayRef extends AbstractRef {
    private base: Local;  // 数组变量
    private index: Value; // 索引

    constructor(base: Local, index: Value) {
        super();
        this.base = base;
        this.index = index;
    }

    /**
     * Returns the base of this array reference. Array reference refers to access to array elements. 
     * Array references usually consist of an local variable and an index. 
     * For example, `a[i]` is a typical array reference, where `a` is the base (i.e., local variable) 
     * pointing to the actual memory location where the array is stored 
     * and `i` is the index indicating access to the `i-th` element from array `a`.
     * @returns the base of this array reference.
     * @example
     * 1. Get the base and the specific elements.
    
    ```typescript
    // Create an array
    let myArray: number[] = [10, 20, 30, 40];
    // Create an ArrayRef object representing a reference to myArray[2]
    let arrayRef = new ArkArrayRef(myArray, 2);
    // Use the getBase() method to get the base of the array
    let baseArray = arrayRef.getBase();

    console.log("Base array:", baseArray);  // Output: Base array: [10, 20, 30, 40]

    // Use baseArray and obeject index of ArrayRef to access to specific array elements
    let element = baseArray[arrayRef.index];
    console.log("Element at index", arrayRef.index, ":", element);  // Output: Element at index 2 : 30
    ```
     */
    public getBase(): Local {
        return this.base;
    }

    public setBase(newBase: Local): void {
        this.base = newBase;
    }

    /**
     * Returns the index of this array reference. 
     * In TypeScript, an array reference means that the variable stores 
     * the memory address of the array rather than the actual data of the array.
     * @returns The index of this array reference.
     */
    public getIndex(): Value {
        return this.index;
    }

    public setIndex(newIndex: Value): void {
        this.index = newIndex;
    }

    public getType(): Type {
        const baseType = this.base.getType();
        if (baseType instanceof ArrayType) {
            return baseType.getBaseType();
        } else {
            logger.warn(`the type of base in ArrayRef is not ArrayType`);
            return UnknownType.getInstance();
        }
    }

    public getUses(): Value[] {
        let uses: Value[] = [];
        uses.push(this.base);
        uses.push(...this.base.getUses());
        uses.push(this.index);
        uses.push(...this.index.getUses());
        return uses;
    }

    public toString(): string {
        return this.base + '[' + this.index + ']';
    }
}

export abstract class AbstractFieldRef extends AbstractRef {
    private fieldSignature: FieldSignature;

    constructor(fieldSignature: FieldSignature) {
        super();
        this.fieldSignature = fieldSignature;
    }

    /**
     * Returns the the field name as a **string**.
     * @returns The the field name.
     */
    public getFieldName(): string {
        return this.fieldSignature.getFieldName();
    }

    /**
     * Returns a field signature, which consists of a class signature, 
     * a **string** field name, and a **boolean** label indicating whether it is static or not.
     * @returns The field signature.
     * @example
     * 1. Compare two Fields

    ```typescript
    const fieldSignature = new FieldSignature();
    fieldSignature.setFieldName(...);
    const fieldRef = new ArkInstanceFieldRef(baseValue as Local, fieldSignature);
    ...
    if (fieldRef.getFieldSignature().getFieldName() === 
        targetField.getFieldSignature().getFieldName()) {
        ...
    }
    ```
     */
    public getFieldSignature(): FieldSignature {
        return this.fieldSignature;
    }

    public setFieldSignature(newFieldSignature: FieldSignature): void {
        this.fieldSignature = newFieldSignature;
    }

    public getType(): Type {
        return this.fieldSignature.getType();
    }
}

export class ArkInstanceFieldRef extends AbstractFieldRef {
    private base: Local;       // which obj this field belong to

    constructor(base: Local, fieldSignature: FieldSignature) {
        super(fieldSignature);
        this.base = base;
    }

    /**
     * Returns the local of field, showing which object this field belongs to.
     * A {@link Local} consists of :
     * - Name: the **string** name of local value, e.g., "$temp0".
     * - Type: the type of value.
     * @returns The object that the field belongs to. 
     * @example
     * 1. Get a base.

    ```typescript
    if (expr instanceof ArkInstanceFieldRef) {
        ...
        let base = expr.getBase();
        if (base.getName() == 'this') {
            ...
        }
            ...
    }
    ```
     */
    public getBase(): Local {
        return this.base;
    }

    public setBase(newBase: Local): void {
        this.base = newBase;
    }

    public getUses(): Value[] {
        let uses: Value[] = [];
        uses.push(this.base);
        uses.push(...this.base.getUses());
        return uses;
    }

    public toString(): string {
        return this.base.toString() + '.<' + this.getFieldSignature() + '>';
    }

    public inferType(arkClass: ArkClass): AbstractRef {
        let baseType: Type | null = this.base.getType();
        if (this.base instanceof Local && baseType instanceof UnknownType) {
            baseType = TypeInference.inferBaseType(this.base.getName(), arkClass);
            if (!baseType && (arkClass.hasComponentDecorator() || arkClass.getCategory() === ClassCategory.OBJECT)) {
                const global = arkClass.getDeclaringArkFile().getScene().getSdkGlobal(this.base.getName());
                baseType = TypeInference.parseArkExport2Type(global);
            }
        } else if (baseType instanceof UnclearReferenceType) {
            baseType = TypeInference.inferUnclearReferenceType(baseType.getName(), arkClass);
        }
        if (!baseType) {
            logger.warn('infer field ref base type fail: ' + this.toString());
            return this;
        }
        if (this.base instanceof Local) {
            this.base.setType(baseType);
        }
        if (baseType instanceof ArrayType && this.getFieldName() !== 'length') {
            return new ArkArrayRef(this.base, ValueUtil.createConst(this.getFieldName()));
        }
        const newFieldSignature = this.getNewFieldSignature(arkClass, baseType);
        if (newFieldSignature.isStatic()) {
            return new ArkStaticFieldRef(newFieldSignature);
        } else {
            this.setFieldSignature(newFieldSignature);
        }
        return this;
    }

    private getNewFieldSignature(arkClass: ArkClass, baseType: Type): FieldSignature {
        let oldFieldSignature = this.getFieldSignature();
        const propertyAndproperty = TypeInference.inferFieldType(baseType, this.getFieldName(), arkClass);
        let property = null;
        let propertyType = oldFieldSignature.getType();
        if (propertyAndproperty) {
            property = propertyAndproperty[0];
            propertyType = propertyAndproperty[1];
        }
        if (TypeInference.isUnclearType(propertyType)) {
            const newType = TypeInference.inferUnclearedType(propertyType, arkClass);
            if (newType) {
                propertyType = newType;
            }
        }
        let newFieldSignature;
        if (baseType instanceof ClassType && property instanceof ArkField) {
            newFieldSignature = property.getSignature();
        } else {
            let staticFlag: boolean;
            let signature: BaseSignature;
            if (baseType instanceof ClassType) {
                staticFlag = baseType.getClassSignature().getClassName() === DEFAULT_ARK_CLASS_NAME ||
                    (property instanceof ArkMethod && property.isStatic());
                signature = baseType.getClassSignature();
            } else if (baseType instanceof AnnotationNamespaceType) {
                staticFlag = true;
                signature = baseType.getNamespaceSignature();
            } else {
                staticFlag = oldFieldSignature.isStatic();
                signature = oldFieldSignature.getDeclaringSignature();
            }
            newFieldSignature = new FieldSignature(this.getFieldName(), signature, propertyType, staticFlag);
        }
        return newFieldSignature;
    }
}

export class ArkStaticFieldRef extends AbstractFieldRef {
    constructor(fieldSignature: FieldSignature) {
        super(fieldSignature);
    }

    public getUses(): Value[] {
        return [];
    }

    public toString(): string {
        return this.getFieldSignature().toString();
    }
}

export class ArkParameterRef extends AbstractRef {
    private index: number;
    private paramType: Type;

    constructor(index: number, paramType: Type) {
        super();
        this.index = index;
        this.paramType = paramType;
    }

    public getIndex(): number {
        return this.index;
    }

    public getType(): Type {
        return this.paramType;
    }

    public setType(newType: Type): void {
        this.paramType = newType;
    }

    public inferType(arkClass: ArkClass): AbstractRef {
        let type = TypeInference.inferUnclearedType(this.paramType, arkClass);
        if (type) {
            this.paramType = type;
        }
        return this;
    }

    public getUses(): Value[] {
        return [];
    }

    public toString(): string {
        return 'parameter' + this.index + ': ' + this.paramType;
    }
}


export class ArkThisRef extends AbstractRef {
    private type: ClassType;

    constructor(type: ClassType) {
        super();
        this.type = type;
    }

    public inferType(arkClass: ArkClass): AbstractRef {
        const className = this.type.getClassSignature().getClassName();
        if (className.startsWith(ANONYMOUS_CLASS_PREFIX)) {
            let type = TypeInference.inferBaseType(className.split(ANONYMOUS_CLASS_DELIMITER)[1], arkClass);
            if (type instanceof ClassType) {
                this.type = type;
            }
        }
        return this;
    }

    public getType(): ClassType {
        return this.type;
    }

    public getUses(): Value[] {
        return [];
    }

    public toString(): string {
        return 'this: ' + this.type;
    }
}

export class ArkCaughtExceptionRef extends AbstractRef {
    private type: Type;

    constructor(type: Type) {
        super();
        this.type = type;
    }

    public getType(): Type {
        return this.type;
    }

    public getUses(): Value[] {
        return [];
    }

    public toString(): string {
        return 'caughtexception: ' + this.type;
    }
}