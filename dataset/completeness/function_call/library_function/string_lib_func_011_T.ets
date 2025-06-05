import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-string_substring
 */
export function string_lib_func_011_T(taint_src : string) {
  let t = taint_src.substring(1,3);
  taint.Sink(t);
}