import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-string_valueOf
 */
export function string_lib_func_005_T(taint_src : string) {
  let t = taint_src.valueOf();
  taint.Sink(t);
}