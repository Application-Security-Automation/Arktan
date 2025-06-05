import { taint } from "../../../../pages/taint";
/**
 * Introduction this表达式
 */


export function this_expression_002_F(taint_src : string) {
  let _t = taint_src;
  let clean = "_";
  let a = new A(clean);
  taint.Sink(a.getValue());
}
class A {
  value : string;

  constructor(t :string) {
    this.value = t;
  }
  getValue() {
    return this.value;
  }
}