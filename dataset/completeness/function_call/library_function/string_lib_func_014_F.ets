import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-string_split
 */
export function string_lib_func_014_F(taint_src : string) {
  let clean = "clean";
  let t = clean.split("f");
  taint.Sink(t);
}