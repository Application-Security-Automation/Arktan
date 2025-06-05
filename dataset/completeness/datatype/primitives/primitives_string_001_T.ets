import { taint } from "../../../../pages/taint";

/**
 * Introduction 基础数据类型-string
 */

export function primitives_string_001_T(taint_src : string) : void {
  taint.Sink(taint_src);
}
