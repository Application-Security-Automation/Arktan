import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-string_split
 */
export function string_lib_func_013_T(taint_src : string) {
  let t = taint_src.split("f");
  taint.Sink(t);
}