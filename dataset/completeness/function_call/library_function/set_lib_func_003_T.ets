import { taint } from "../../../../pages/taint";

/**
 * Introduction 库函数-set_values
 */
export function set_lib_func_003_T(taint_src : string) {
  let s = new Set<string>();
  s.add(taint_src);
  taint.Sink(s.values());
}