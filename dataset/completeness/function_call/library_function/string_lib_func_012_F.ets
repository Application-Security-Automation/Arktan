import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-string_substring
 */
export function string_lib_func_012_F(taint_src : string) {
  let clean = "clean";
  let t = clean.substring(1,3);
  taint.Sink(t);
}