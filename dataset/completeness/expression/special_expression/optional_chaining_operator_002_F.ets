import { taint } from "../../../../pages/taint";

/**
 * Introduction 可选链操作符
 */
export function optional_chaining_operator_002_F(taint_src : string) {
  let _t = taint_src;
  let a = new A("_");
  taint.Sink(a?.data);
}
class A {
  data: string;

  constructor(t : string) {
    this.data = t;
  }
}
