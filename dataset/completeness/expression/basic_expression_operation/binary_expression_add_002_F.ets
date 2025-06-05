import { taint } from "../../../../pages/taint";
/**
 * Introduction 基础表达式运算-二元运算-加
 */

export function binary_expression_add_002_F(taint_src : string) {
  let _t = taint_src;
  let clean = "a" + "b";
  taint.Sink(clean);
}