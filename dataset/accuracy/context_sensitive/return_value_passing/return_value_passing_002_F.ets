import { taint } from "../../../../pages/taint";

/**
 * Introduction 返回值传递
 */
export function return_value_passing_002_F(taint_src : string) {
  let _t = taint_src;
  let _clean = "clean";
  let t = f(_clean);
  taint.Sink(t);
}
function f(t : string) {
  return t;
}