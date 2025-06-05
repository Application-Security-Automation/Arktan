import { taint } from "../../../../pages/taint";
/**
 * Introduction 箭头函数-一阶
 */

export function arrow_function_001_T(taint_src : string) {
  let arrowFunction = (t : string): void => taint.Sink(t)
  arrowFunction(taint_src);
}
