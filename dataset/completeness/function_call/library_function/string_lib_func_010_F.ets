import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-string_slice
 */
export function string_lib_func_010_F(taint_src : string) {
  let clean = "clean";
  let t = clean.slice(0,1);
  taint.Sink(t);
}