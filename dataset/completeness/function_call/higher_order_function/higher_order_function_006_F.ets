import { taint } from "../../../../pages/taint";
/**
 * Introduction 高阶函数-箭头函数作参数
 */

export function higher_order_function_006_F(taint_src : string) {
  let _t = taint_src;
  let _clean = "clean";
  let arrowf6 = (a: string, b: string) => a + b ;
  let t = higherOrderFunction(arrowf6 , _clean, "a");
  taint.Sink(t);
}
function higherOrderFunction(callback : Function, a: string, b: string) : Function {
  return callback(a,b);
}

