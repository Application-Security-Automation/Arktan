import { taint } from "../../../../pages/taint";

/**
 * Introduction 库函数-set_values
 */
export function set_lib_func_004_F(taint_src : string) {
  let s = new Set<string>();
  s.add("_");
  taint.Sink(s.values());
}