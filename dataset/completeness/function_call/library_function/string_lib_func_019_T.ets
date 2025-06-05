import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-string_toLowerCase
 */
export function string_lib_func_019_T(taint_src : string) {
  let t = taint_src.toLowerCase();
  taint.Sink(t);
}