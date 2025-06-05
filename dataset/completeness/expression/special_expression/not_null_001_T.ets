import { taint } from "../../../../pages/taint";

/**
 * Introduction 非空断言操作符
 */
export function not_null_001_T(taint_src : string) {
  let a = new A(taint_src);
  taint.Sink(a!.data);
}
class A {
  data: string;

  constructor(t : string) {
    this.data = t;
  }
}