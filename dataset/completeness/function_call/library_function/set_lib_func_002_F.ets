import { taint } from "../../../../pages/taint";

/**
 * Introduction 库函数-set_add
 */
export function set_lib_func_002_F(taint_src : string) {
  let s = new Set<string>();
  s.add("_");
  taint.Sink(s);
}