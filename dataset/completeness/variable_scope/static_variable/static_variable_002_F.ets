import { taint } from "../../../../pages/taint";
/**
 * Introduction 类静态变量
 */

export function static_variable_002_F(taint_src : string) {
  let _t = taint_src
  let _clean = "clean"
  A.data = _clean
  taint.Sink(A.data);
}
class A {
  static data:string
}