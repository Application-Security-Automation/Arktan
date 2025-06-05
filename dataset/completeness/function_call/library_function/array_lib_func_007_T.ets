import { taint } from "../../../../pages/taint";

/**
 * Introduction 库函数-array_shift
 */
export function array_lib_func_007_T(taint_src : string) {
  let arr : string[] = [taint_src,"a","b"];
  let t = arr.shift();
  taint.Sink(t!);
}