import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-string_toUpperCase
 */
export function string_lib_func_017_T(taint_src : string) {
  let t = taint_src.toUpperCase();
  taint.Sink(t);
}