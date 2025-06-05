import { taint } from "../../../../pages/taint";
/**
 * Introduction 参数传递-普通参数传递
 */

export function argument_passing_002_F(taint_src : string) {
  let _t = taint_src
  let _clean = "clean"
  f(_clean);
}
function f(t : string) {
  taint.Sink(t);
}