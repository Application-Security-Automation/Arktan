import { taint } from "../../../../pages/taint";
/**
 * Introduction 类私有变量
 */

export function private_variable_002_F(taint_src : string) {
  let _t = taint_src
  let _clean = "clean"
  let a = new A();
  a.setData(_clean);
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