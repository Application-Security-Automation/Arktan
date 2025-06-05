import { taint } from "../../../../pages/taint";
/**
 * Introduction this表达式
 */


export function this_expression_001_T(taint_src : string) {

  let a = new A(taint_src);
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