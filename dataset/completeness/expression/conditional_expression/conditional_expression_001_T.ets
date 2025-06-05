import { taint } from "../../../../pages/taint";
/**
 * Introduction 条件表达式
 */

export function conditional_expression_001_T(taint_src : string) {
  let t = true ? taint_src : "_";
  taint.Sink(t);
}