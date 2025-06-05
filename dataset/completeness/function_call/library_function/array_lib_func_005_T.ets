import { taint } from "../../../../pages/taint";

/**
 * Introduction 库函数-array_push
 */
export function array_lib_func_005_T(taint_src : string) {
  let arr : string[] = ["a","b"];
  arr.push(taint_src);
  taint.Sink(arr);
}