import { taint } from "../../../../pages/taint";
/**
 * Introduction 动态方法调用-反射
 */

export function reflect_call_002_F(taint_src : string) {
  let _t = taint_src;
  class A {
    data: string = "_";
  }
  let a = new A();
  taint.Sink(Reflect.get(a,"data"));
}