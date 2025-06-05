import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-string_concat
 */
export function string_lib_func_001_T(taint_src : string) {
  let t = taint_src.concat("_");
  taint.Sink(t);
}