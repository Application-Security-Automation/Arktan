import { taint } from "../../../../pages/taint";
/**
 * Introduction 参数传递-参数位置
 */

export function argument_passing_002_F(taint_src : string) {
  f(taint_src,"_");
}
function f(a : string, b : string) {
  taint.Sink(b);
}