import { taint } from "../../../../pages/taint";

/**
 * Introduction 库函数-array_pop
 */
export function array_lib_func_003_T(taint_src : string) {
  let arr : string[] = ["a","b",taint_src];
  let t = arr.pop();
  taint.Sink(t!);
}