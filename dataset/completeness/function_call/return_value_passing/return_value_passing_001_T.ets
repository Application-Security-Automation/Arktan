import { taint } from "../../../../pages/taint";

/**
 * Introduction 返回值传递
 */
export function return_value_passing_001_T(taint_src : string) {
  let t = f(taint_src);
  taint.Sink(t);
}
function f(t : string) {
  return t;
}