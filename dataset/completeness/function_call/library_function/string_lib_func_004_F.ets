import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-string_toString
 */
export function string_lib_func_004_F(taint_src : string) {
  let clean = "clean";
  let t = clean.toString();
  taint.Sink(t);
}