import { ArkMethod } from "../../../Arkanalyzer/core/model/ArkMethod";
import { CallEdge } from "../CallEdge";
import { MyPointerAnalysis } from "../MyPointerAnalysis";

export interface Plugin {
    setSolver?(solver : MyPointerAnalysis) : void;
    onStart?() : void;
    onNewMethod?(method : ArkMethod) : void;
    onNewCallEdge?(edge : CallEdge) : void;
    onFinish?() : void;
}