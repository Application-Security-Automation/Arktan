import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-string_trim
 */
export function string_lib_func_015_T(taint_src : string) {
  let t = taint_src.trim();
  taint.Sink(t);
}