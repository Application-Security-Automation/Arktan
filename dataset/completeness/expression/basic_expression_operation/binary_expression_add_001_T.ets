import { taint } from "../../../../pages/taint";
/**
 * Introduction 基础表达式运算-二元运算-加
 */

export function binary_expression_add_001_T(taint_src : string) {
  let t = taint_src + "_";
  taint.Sink(t);
}