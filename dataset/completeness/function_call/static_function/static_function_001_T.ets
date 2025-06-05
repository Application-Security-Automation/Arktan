import { taint } from "../../../../pages/taint";
/**
 * Introduction 静态函数
 */
export function static_function_001_T(taint_src : string) {

  A.f(taint_src);
}
class A {
  static f(t : string) {
    taint.Sink(t);
  }
}