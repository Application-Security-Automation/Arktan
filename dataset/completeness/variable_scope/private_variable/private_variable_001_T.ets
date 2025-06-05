import { taint } from "../../../../pages/taint";
/**
 * Introduction 类私有变量
 */

export function private_variable_001_T(taint_src : string) {
  let a = new A();
  a.setData(taint_src);
  taint.Sink(a.getData());
}
class A {
  private data : string = "";
  setData(t : string) {
    this.data = t;
  }
  getData() {
    return this.data;
  }
}