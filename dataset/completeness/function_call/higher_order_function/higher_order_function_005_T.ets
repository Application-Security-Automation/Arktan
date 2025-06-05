import { taint } from "../../../../pages/taint";
/**
 * Introduction 高阶函数-箭头函数作参数
 */

export function higher_order_function_005_T(taint_src : string) {
  let arrowf5 = (a: string, b: string) => a + b ;
  let t = higherOrderFunction(arrowf5, taint_src, "a");
  taint.Sink(t);
}
function higherOrderFunction(callback : Function, a: string, b: string) : string {
  return callback(a,b);
}

