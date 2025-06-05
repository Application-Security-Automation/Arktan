import { taint } from "../../../../pages/taint";

/**
 * Introduction 库函数-array_toString
 */
export function array_lib_func_002_F(taint_src : string) {
  let arr : string[] = ["_","a","b"];
  let t = arr.toString();
  taint.Sink(t);
}