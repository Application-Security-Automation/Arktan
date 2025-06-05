import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-string_concat
 */
export function string_lib_func_002_F(taint_src : string) {
  let clean = "clean";
  let t = clean.concat("_");
  taint.Sink(t);
}