import { taint } from "../../../../pages/taint";

/**
 * Introduction 库函数-array_pop
 */
export function array_lib_func_004_F(taint_src : string) {
  let arr : string[] = ["a","b","_"];
  let t = arr.pop();
  taint.Sink(t!);
}