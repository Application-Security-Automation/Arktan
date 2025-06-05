import { Type } from "../../Arkanalyzer/core/base/Type";
import { ArkMethod } from "../../Arkanalyzer/core/model/ArkMethod";

export class Var {
    private method : ArkMethod;
    private name : String;
    private type : Type;
    constructor(method: ArkMethod, name: String, type: Type) {
        this.method = method;
        this.name = name;
        this.type = type;
    }
    public getType() : Type {
        return this.type;
    }
    public getMethod() : ArkMethod {
        return this.method;
    }
    public getName() : String {
        return this.name;
    }
}