import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-string_valueOf
 */
export function string_lib_func_006_F(taint_src : string) {
  let clean = "clean";
  let t = clean.valueOf();
  taint.Sink(t);
}