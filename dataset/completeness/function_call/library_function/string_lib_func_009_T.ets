import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-string_slice
 */
export function string_lib_func_009_T(taint_src : string) {
  let t = taint_src.slice(0,1);
  taint.Sink(t);
}