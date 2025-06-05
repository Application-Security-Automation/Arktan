import { taint } from "../../../../pages/taint";
/**
 * Introduction 参数传递-默认参数值
 */

export function argument_passing_003_T(taint_src : string) {
  f(taint_src);
}
function f(t : string = "default_value") {
  taint.Sink(t);
}