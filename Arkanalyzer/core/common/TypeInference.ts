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
import { AbstractExpr, ArkInstanceInvokeExpr, ArkStaticInvokeExpr } from '../base/Expr';
import { Local } from '../base/Local';
import {
    AbstractFieldRef,
    AbstractRef,
    ArkArrayRef,
    ArkInstanceFieldRef,
    ArkParameterRef,
    ArkStaticFieldRef,
    ArkThisRef,
} from '../base/Ref';
import { ArkAssignStmt, ArkInvokeStmt, Stmt } from '../base/Stmt';
import {
    AliasType,
    AnnotationNamespaceType,
    AnyType,
    ArrayType,
    BooleanType,
    ClassType,
    FunctionType,
    GenericType,
    NeverType,
    NullType,
    NumberType,
    StringType,
    Type,
    UnclearReferenceType,
    UndefinedType,
    UnionType,
    UnknownType,
    VoidType,
} from '../base/Type';
import { ArkMethod } from '../model/ArkMethod';
import { ArkExport } from '../model/ArkExport';
import { ArkClass } from '../model/ArkClass';
import { ArkField, FieldCategory } from '../model/ArkField';
import { Value } from '../base/Value';
import { Constant } from '../base/Constant';
import { ArkNamespace } from '../model/ArkNamespace';
import { CONSTRUCTOR_NAME, SUPER_NAME } from './TSConst';
import { ModelUtils } from './ModelUtils';
import { Builtin } from './Builtin';
import { MethodSignature, MethodSubSignature } from '../model/ArkSignature';
import { INSTANCE_INIT_METHOD_NAME, UNKNOWN_FILE_NAME } from './Const';
import { EMPTY_STRING } from './ValueUtil';

const logger = Logger.getLogger(LOG_MODULE_TYPE.ARKANALYZER, 'TypeInference');


export class TypeInference {

    public static inferTypeInArkField(arkField: ArkField): void {
        const arkClass = arkField.getDeclaringArkClass();
        const stmts = arkField.getInitializer();
        let rightType: Type | undefined;
        let fieldRef: AbstractFieldRef | undefined;
        if (stmts) {
            for (const stmt of stmts) {
                this.resolveExprsInStmt(stmt, arkClass);
                this.resolveFieldRefsInStmt(stmt, arkClass, arkClass.getMethodWithName(INSTANCE_INIT_METHOD_NAME));
                this.resolveArkAssignStmt(stmt, arkClass);
            }
            const lastStmt = stmts[stmts.length - 1];
            if (lastStmt instanceof ArkAssignStmt) {
                rightType = lastStmt.getRightOp().getType();
                if (lastStmt.getLeftOp() instanceof AbstractFieldRef) {
                    fieldRef = lastStmt.getLeftOp() as AbstractFieldRef;
                }
            }
        }

        const beforeType = arkField.getType();
        let fieldType;
        if (arkField.getCategory() === FieldCategory.ENUM_MEMBER) {
            fieldType = new ClassType(arkClass.getSignature());
        } else if (beforeType) {
            fieldType = this.inferUnclearedType(beforeType, arkClass, rightType);
        }

        if (fieldType) {
            arkField.getSignature().setType(fieldType);
            fieldRef?.setFieldSignature(arkField.getSignature());
        } else if (rightType && this.isUnclearType(beforeType) && !this.isUnclearType(rightType)) {
            arkField.getSignature().setType(rightType);
            fieldRef?.setFieldSignature(arkField.getSignature());
        }
    }

    public static inferUnclearedType(leftOpType: Type, declaringArkClass: ArkClass, rightType?: Type) {
        let type;
        if (leftOpType instanceof UnclearReferenceType) {
            type = this.inferUnclearRefType(leftOpType, declaringArkClass);
        } else if (leftOpType instanceof ClassType
            && leftOpType.getClassSignature().getDeclaringFileSignature().getFileName() === UNKNOWN_FILE_NAME) {
            type = TypeInference.inferUnclearReferenceType(leftOpType.getClassSignature().getClassName(), declaringArkClass);
        } else if (leftOpType instanceof UnionType) {
            let types = leftOpType.getTypes();
            for (let i = 0; i < types.length; i++) {
                let optionType = types[i];
                let newType;
                if (optionType instanceof ClassType) {
                    newType = TypeInference.inferUnclearReferenceType(optionType.getClassSignature().getClassName(), declaringArkClass);
                } else if (optionType instanceof UnclearReferenceType) {
                    newType = TypeInference.inferUnclearReferenceType(optionType.getName(), declaringArkClass);
                } else {
                    newType = optionType;
                }
                if (newType && newType !== optionType) {
                    types[i] = newType;
                }
                if (rightType && newType && newType === rightType) {
                    leftOpType.setCurrType(rightType);
                    type = leftOpType;
                }
            }
        } else if (leftOpType instanceof ArrayType) {
            let baseType = this.inferUnclearedType(leftOpType.getBaseType(), declaringArkClass);
            if (baseType) {
                leftOpType.setBaseType(baseType);
                type = leftOpType;
            }
        } else if (leftOpType instanceof AliasType) {
            let baseType = this.inferUnclearedType(leftOpType.getOriginalType(), declaringArkClass);
            if (baseType) {
                leftOpType.setOriginalType(baseType);
                type = leftOpType;
            }
        } else if (leftOpType instanceof AnnotationNamespaceType) {
            type = this.inferUnclearReferenceType(leftOpType.getOriginType(), declaringArkClass);
        }
        return type;
    }

    public static inferTypeInMethod(arkMethod: ArkMethod): void {
        const body = arkMethod.getBody();
        if (!body) {
            logger.warn('empty body');
            return;
        }
        const arkClass = arkMethod.getDeclaringArkClass();
        body.getAliasTypeMap()?.forEach((value) => this.inferUnclearedType(value[0], arkClass));
        this.inferGenericType(arkMethod.getGenericTypes(), arkClass);
        const cfg = body.getCfg();
        for (const block of cfg.getBlocks()) {
            for (const stmt of block.getStmts()) {
                this.resolveExprsInStmt(stmt, arkClass);
                this.resolveFieldRefsInStmt(stmt, arkClass, arkMethod);
                this.resolveArkAssignStmt(stmt, arkClass);
            }
        }
        this.inferMethodReturnType(arkMethod);
    }

    /**
     * @Deprecated
     * @param arkMethod
     */
    public static inferSimpleTypeInMethod(arkMethod: ArkMethod): void {
        const body = arkMethod.getBody();
        if (!body) {
            logger.warn('empty body');
            return;
        }
        const cfg = body.getCfg();
        for (const block of cfg.getBlocks()) {
            for (const stmt of block.getStmts()) {
                TypeInference.inferSimpleTypeInStmt(stmt);
            }
        }
    }

    /**
     * infer type for Exprs in stmt which invoke method.
     * such as ArkInstanceInvokeExpr ArkStaticInvokeExpr ArkNewExpr
     */
    private static resolveExprsInStmt(stmt: Stmt, arkClass: ArkClass): void {
        const exprs = stmt.getExprs();
        for (const expr of exprs) {
            const newExpr = expr.inferType(arkClass);
            if (stmt.containsInvokeExpr() && expr instanceof ArkInstanceInvokeExpr && newExpr instanceof ArkStaticInvokeExpr) {
                if (stmt instanceof ArkAssignStmt && stmt.getRightOp() instanceof ArkInstanceInvokeExpr) {
                    stmt.setRightOp(newExpr);
                } else if (stmt instanceof ArkInvokeStmt) {
                    stmt.replaceInvokeExpr(newExpr);
                }
            }
        }
    }

    /**
     * infer type for fieldRefs in stmt.
     */
    private static resolveFieldRefsInStmt(stmt: Stmt, arkClass: ArkClass, arkMethod: ArkMethod | null): void {
        for (const use of stmt.getUses()) {
            if (use instanceof AbstractRef) {
                const fieldRef = use.inferType(arkClass);
                if (fieldRef instanceof ArkStaticFieldRef && stmt instanceof ArkAssignStmt) {
                    if (stmt.getRightOp() instanceof ArkInstanceFieldRef) {
                        stmt.setRightOp(fieldRef);
                    } else {
                        stmt.replaceUse(use, fieldRef);
                        stmt.setRightOp(stmt.getRightOp());
                    }
                } else if (use instanceof ArkInstanceFieldRef && fieldRef instanceof ArkArrayRef && stmt instanceof ArkAssignStmt) {
                    const index = fieldRef.getIndex();
                    if (index instanceof Constant && index.getType() instanceof StringType) {
                        const local = arkMethod?.getBody()?.getLocals().get(index.getValue());
                        if (local) {
                            fieldRef.setIndex(local);
                        }
                    }
                    stmt.replaceUse(use, fieldRef);
                    stmt.setRightOp(stmt.getRightOp());
                }
            }
        }
        const stmtDef = stmt.getDef();
        if (stmtDef && stmtDef instanceof AbstractRef) {
            const fieldRef = stmtDef.inferType(arkClass);
            if (fieldRef instanceof ArkStaticFieldRef && stmt instanceof ArkAssignStmt) {
                stmt.setLeftOp(fieldRef);
            }
        }
    }

    public static parseArkExport2Type(arkExport: ArkExport | undefined | null): Type | null {
        if (!arkExport) {
            return null;
        }
        if (arkExport instanceof ArkClass) {
            return new ClassType(arkExport.getSignature(), arkExport.getGenericsTypes()
                ?.map((x, index) => {
                    let defaultType = x.getDefaultType();
                    if (defaultType instanceof UnclearReferenceType) {
                        const newType = TypeInference.inferUnclearReferenceType(defaultType.getName(), arkExport);
                        if (newType) {
                            defaultType = newType;
                        }
                    }
                    return defaultType ?? UndefinedType.getInstance();
                }));
        } else if (arkExport instanceof ArkNamespace) {
            let namespaceType = new AnnotationNamespaceType(arkExport.getName());
            namespaceType.setNamespaceSignature(arkExport.getSignature());
            return namespaceType;
        } else if (arkExport instanceof ArkMethod) {
            return new FunctionType(arkExport.getSignature());
        } else if (arkExport instanceof Local) {
            if (arkExport.getType() instanceof UnknownType || arkExport.getType() instanceof UnclearReferenceType) {
                return null;
            }
            return arkExport.getType();
        } else if (arkExport instanceof AliasType) {
            return arkExport;
        } else {
            return null;
        }
    }

    /**
     * infer and pass type for ArkAssignStmt right and left
     * @param stmt
     * @param arkClass
     */
    public static resolveArkAssignStmt(stmt: Stmt, arkClass: ArkClass): void {
        if (!(stmt instanceof ArkAssignStmt)) {
            return;
        }
        const rightOp = stmt.getRightOp();
        if (rightOp instanceof Local && rightOp.getType() instanceof UnknownType) {
            const type = this.inferUnclearReferenceType(rightOp.getName(), arkClass);
            if (type) {
                rightOp.setType(type);
            }
        } else if (rightOp.getType() instanceof UnclearReferenceType) {
            const type = this.inferUnclearReferenceType((rightOp.getType() as UnclearReferenceType).getName(), arkClass);
            if (type && rightOp instanceof ArkParameterRef) {
                rightOp.setType(type);
            }
        }
        const leftOp = stmt.getLeftOp();
        if (leftOp instanceof Local) {
            const leftOpType = leftOp.getType();
            let type = this.inferUnclearedType(leftOpType, arkClass, rightOp.getType());
            if (type) {
                leftOp.setType(type);
            } else if (rightOp instanceof ArkThisRef) {
                leftOp.setType(rightOp.getType());
            } else if (this.isUnclearType(leftOpType) && !this.isUnclearType(stmt.getRightOp().getType())) {
                leftOp.setType(stmt.getRightOp().getType());
            }
        }
    }

    public static isUnclearType(type: Type | null | undefined) {
        if (!type || type instanceof UnknownType || type instanceof UnclearReferenceType) {
            return true;
        } else if (type instanceof ClassType
            && type.getClassSignature().getDeclaringFileSignature().getFileName() === UNKNOWN_FILE_NAME) {
            return true;
        }
        return false;
    }

    public static inferSimpleTypeInStmt(stmt: Stmt): void {
        if (stmt instanceof ArkAssignStmt) {
            const leftOp = stmt.getLeftOp();
            if (leftOp instanceof Local) {
                const leftOpType = leftOp.getType();
                if (leftOpType instanceof UnknownType) {
                    const rightOp = stmt.getRightOp();
                    leftOp.setType(rightOp.getType());
                }
            }
        }
    }

    // Deal only with simple situations
    public static buildTypeFromStr(typeStr: string): Type {
        switch (typeStr) {
            case 'boolean':
                return BooleanType.getInstance();
            case 'number':
                return NumberType.getInstance();
            case 'string':
                return StringType.getInstance();
            case 'undefined':
                return UndefinedType.getInstance();
            case 'null':
                return NullType.getInstance();
            case 'any':
                return AnyType.getInstance();
            case 'void':
                return VoidType.getInstance();
            case 'never':
                return NeverType.getInstance();
            case 'RegularExpression': {
                const classSignature = Builtin.REGEXP_CLASS_SIGNATURE;
                return new ClassType(classSignature);
            }
            default:
                return new UnclearReferenceType(typeStr);
        }
    }

    public static inferValueType(value: Value, arkClass: ArkClass): Type | null {
        if (value instanceof ArkInstanceFieldRef || value instanceof ArkInstanceInvokeExpr) {
            this.inferValueType(value.getBase(), arkClass);
        }
        if (value instanceof AbstractRef || value instanceof AbstractExpr || value instanceof Local) {
            value.inferType(arkClass);
        }
        return value.getType();
    }

    public static inferMethodReturnType(method: ArkMethod) {
        const oldMethodSignature = method.getSignature();
        const oldMethodSubSignature = oldMethodSignature.getMethodSubSignature();
        if (method.getName() === CONSTRUCTOR_NAME) {
            const newReturnType = new ClassType(method.getDeclaringArkClass().getSignature());
            const newMethodSubSignature = new MethodSubSignature(oldMethodSubSignature.getMethodName(),
                oldMethodSubSignature.getParameters(), newReturnType, oldMethodSubSignature.isStatic());
            method.setSignature(
                new MethodSignature(oldMethodSignature.getDeclaringClassSignature(), newMethodSubSignature));
            return;
        }
        const returnType = method.getReturnType();
        let inferType;
        if (returnType instanceof UnclearReferenceType) {
            inferType = this.inferUnclearReferenceType(returnType.getName(), method.getDeclaringArkClass());
        }
        if (inferType) {
            const newMethodSubSignature = new MethodSubSignature(oldMethodSubSignature.getMethodName(),
                oldMethodSubSignature.getParameters(), inferType, oldMethodSubSignature.isStatic());
            method.setSignature(
                new MethodSignature(oldMethodSignature.getDeclaringClassSignature(), newMethodSubSignature));
        }
    }

    public static inferGenericType(types: GenericType[] | undefined, arkClass: ArkClass) {
        types?.forEach(type => {
            const defaultType = type.getDefaultType();
            if (defaultType instanceof UnclearReferenceType) {
                const newDefaultType = TypeInference.inferUnclearReferenceType(defaultType.getName(), arkClass);
                if (newDefaultType) {
                    type.setDefaultType(newDefaultType);
                }
            }
            const constraint = type.getConstraint();
            if (constraint instanceof UnclearReferenceType) {
                const newConstraint = TypeInference.inferUnclearReferenceType(constraint.getName(), arkClass);
                if (newConstraint) {
                    type.setConstraint(newConstraint);
                }
            }
        });
    }

    public static inferUnclearRefType(urType: UnclearReferenceType, arkClass: ArkClass): Type | null {
        const realTypes = urType.getGenericTypes();
        this.inferRealGenericTypes(realTypes, arkClass);
        if (urType.getName() === Builtin.ARRAY) {
            return new ArrayType(realTypes[0] ?? AnyType, 1);
        }
        const type = this.inferUnclearReferenceType(urType.getName(), arkClass);
        if (realTypes.length === 0) {
            return type;
        }
        if (type instanceof ClassType) {
            return new ClassType(type.getClassSignature(), realTypes);
        } else if (type instanceof FunctionType) {
            return new FunctionType(type.getMethodSignature(), realTypes);
        } else {
            return new UnclearReferenceType(urType.getName(), realTypes);
        }
    }

    public static inferUnclearReferenceType(refName: string, arkClass: ArkClass): Type | null {
        if (!refName) {
            return null;
        }
        //split and iterate to infer each type
        const singleNames = refName.split('.');
        let type = null;
        for (let i = 0; i < singleNames.length; i++) {
            let genericName: string = EMPTY_STRING;
            const name = singleNames[i].replace(/<(\w+)>/, (match, group1) => {
                genericName = group1;
                return EMPTY_STRING;
            });
            if (i === 0) {
                type = this.inferBaseType(name, arkClass);
            } else if (type) {
                type = this.inferFieldType(type, name, arkClass)?.[1];
            }
            if (!type) {
                return null;
            }
            if (genericName) {
                const realTypes = genericName.split(',').map(generic => {
                    const realType = this.inferBaseType(generic, arkClass);
                    return realType ?? new UnclearReferenceType(generic);
                });
                if (type instanceof ClassType) {
                    type = new ClassType(type.getClassSignature(), realTypes);
                } else if (type instanceof FunctionType) {
                    type = new FunctionType(type.getMethodSignature(), realTypes);
                }
            }
        }
        return type;
    }

    public static inferFieldType(baseType: Type, fieldName: string, declareClass: ArkClass): [any, Type] | null {
        if (baseType instanceof AliasType) {
            baseType = baseType.getOriginalType();
        } else if (baseType instanceof UnionType && baseType.getCurrType()) {
            baseType = baseType.getCurrType();
        }
        let propertyAndType: [any, Type] | null = null;
        if (baseType instanceof ClassType) {
            const arkClass = declareClass.getDeclaringArkFile().getScene().getClass(baseType.getClassSignature());
            if (!arkClass) {
                if (fieldName === Builtin.ITERATOR_RESULT_VALUE && baseType.getClassSignature()
                    .getDeclaringFileSignature().getProjectName() === Builtin.DUMMY_PROJECT_NAME) {
                    const types = baseType.getRealGenericTypes();
                    if (types && types.length > 0) {
                        propertyAndType = [null, types[0]];
                    }
                }
                return propertyAndType;
            }
            const property = ModelUtils.findPropertyInClass(fieldName, arkClass);
            let propertyType: Type | null = null;
            if (property instanceof ArkField) {
                propertyType = property.getType();
            } else if (property) {
                propertyType = this.parseArkExport2Type(property);
            }
            if (propertyType) {
                propertyAndType = [property, propertyType];
            }
        } else if (baseType instanceof AnnotationNamespaceType) {
            const namespace = declareClass.getDeclaringArkFile().getScene().getNamespace(baseType.getNamespaceSignature());
            if (namespace) {
                const property = ModelUtils.findPropertyInNamespace(fieldName, namespace);
                const propertyType = this.parseArkExport2Type(property);
                if (propertyType) {
                    propertyAndType = [property, propertyType];
                }
            }
        } else {
            logger.warn('infer unclear reference type fail: ' + fieldName);
        }
        return propertyAndType;
    }

    public static inferBaseType(baseName: string, arkClass: ArkClass): Type | null {
        if (SUPER_NAME === baseName) {
            return this.parseArkExport2Type(arkClass.getSuperClass());
        }
        const field = arkClass.getDeclaringArkFile().getDefaultClass().getDefaultArkMethod()
            ?.getBody()?.getLocals()?.get(baseName);
        if (field && !this.isUnclearType(field.getType())) {
            return field.getType();
        }
        let arkExport: ArkExport | null = ModelUtils.getClassWithName(baseName, arkClass)
            ?? ModelUtils.getNamespaceWithName(baseName, arkClass)
            ?? ModelUtils.getDefaultClass(arkClass)?.getMethodWithName(baseName)
            ?? ModelUtils.getDefaultClass(arkClass)?.getDefaultArkMethod()?.getBody()?.getAliasTypeByName(baseName)
            ?? ModelUtils.getArkExportInImportInfoWithName(baseName, arkClass.getDeclaringArkFile());
        if (!arkExport && !arkClass.getDeclaringArkFile().getImportInfoBy(baseName)) {
            arkExport = arkClass.getDeclaringArkFile().getScene().getSdkGlobal(baseName);
        }
        return this.parseArkExport2Type(arkExport);
    }

    public static inferRealGenericTypes(realTypes: Type[] | undefined, arkClass: ArkClass): void {
        if (!realTypes) {
            return;
        }
        for (let i = 0; i < realTypes.length; i++) {
            const mayType = realTypes[i];
            if (this.isUnclearType(mayType)) {
                const newType = this.inferUnclearedType(mayType, arkClass);
                if (newType) {
                    realTypes[i] = newType;
                }
            }
        }
    }
}