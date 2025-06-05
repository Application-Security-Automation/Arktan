import { taint } from "../../../../pages/taint";

/**
 * Introduction 库函数-array_toString
 */
export function array_lib_func_001_T(taint_src : string) {
  let arr : string[] = [taint_src,"a","b"];
  let t = arr.toString();
  taint.Sink(t);
}