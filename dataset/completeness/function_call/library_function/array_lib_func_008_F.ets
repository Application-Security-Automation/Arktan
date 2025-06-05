import { taint } from "../../../../pages/taint";

/**
 * Introduction 库函数-array_shift
 */
export function array_lib_func_008_F(taint_src : string) {
  let arr : string[] = ["_","a","b"];
  let t = arr.shift();
  taint.Sink(t!);
}