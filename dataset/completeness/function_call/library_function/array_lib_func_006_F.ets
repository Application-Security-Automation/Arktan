import { taint } from "../../../../pages/taint";

/**
 * Introduction 库函数-array_push
 */
export function array_lib_func_006_F(taint_src : string) {
  let arr : string[] = ["a","b"];
  arr.push("_");
  taint.Sink(arr);
}