import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-string_toString
 */
export function string_lib_func_003_T(taint_src : string) {
  let t = taint_src.toString();
  taint.Sink(t);
}