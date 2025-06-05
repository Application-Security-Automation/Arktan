import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-string_toLowerCase
 */
export function string_lib_func_020_F(taint_src : string) {
  let clean = "clean";
  let t = clean.toLowerCase();
  taint.Sink(t);
}