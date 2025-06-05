import { taint } from "../../../../pages/taint";

/**
 * Introduction 扩展运算符
 */
export function spread_operator_001_T(taint_src : string) {
  let array1 = ['a', 'b', taint_src];
  let array = ['c', ...array1];
  taint.Sink(array[4]);
}