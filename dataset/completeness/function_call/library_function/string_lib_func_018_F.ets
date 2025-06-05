import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-string_toUpperCase
 */
export function string_lib_func_018_F(taint_src : string) {
  let clean = "clean";
  let t = clean.toUpperCase();
  taint.Sink(t);
}