import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-string_trim
 */
export function string_lib_func_016_F(taint_src : string) {
  let clean = "clean";
  let t = clean.trim();
  taint.Sink(t);
}