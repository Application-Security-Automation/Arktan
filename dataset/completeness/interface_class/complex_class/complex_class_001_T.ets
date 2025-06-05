import { taint } from "../../../../pages/taint";

/**
 * Introduction 嵌套类
 */
export function complex_class_001_T(taint_src : string) {
  let b = new B();
  b.setData(taint_src);
  taint.Sink(b.data.getData());
}
class A {
  data : string;
  constructor(s : string) {
    this.data = s;
  }
  getData() {
    return this.data;
  }
}
class B {
  data : A;
  constructor() {
    this.data = new A("_");
  }
  setData(t : string) {
    this.data.data = t;
  }
}