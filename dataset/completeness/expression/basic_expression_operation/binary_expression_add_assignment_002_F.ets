import { taint } from "../../../../pages/taint";
/**
 * Introduction 基础表达式运算-二元运算-加等
 */

export function binary_expression_add_assignment_002_F(taint_src : string) {
  let _t = taint_src;
  let clean = "_";
  clean += "_";
  taint.Sink(clean);
}