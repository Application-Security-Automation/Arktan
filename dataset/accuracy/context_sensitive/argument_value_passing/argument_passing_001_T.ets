import { taint } from "../../../../pages/taint";
/**
 * Introduction 参数传递-普通参数传递
 */

export function argument_passing_001_T(taint_src : string) {
  f(taint_src);
}
function f(t : string) {
  taint.Sink(t);
}