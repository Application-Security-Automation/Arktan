import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-string_replace
 */
export function string_lib_func_008_F(taint_src : string) {
  let clean = "clean";
  let t = clean.replace("a","b");
  taint.Sink(t);
}