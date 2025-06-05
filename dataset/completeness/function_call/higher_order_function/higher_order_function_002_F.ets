import { taint } from "../../../../pages/taint";
/**
 * Introduction 高阶函数-一阶
 */

export function higher_order_function_002_F(taint_src : string) {
  let _t = taint_src;
  let _clean = "clean";
  taint.Sink(f22()(_clean,"a"));
}
function f22() {
  return (a: string, b: string) => {
    return a + b
  }
}