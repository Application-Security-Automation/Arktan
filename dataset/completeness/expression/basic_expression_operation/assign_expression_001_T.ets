import { taint } from "../../../../pages/taint";

/**
 * Introduction 基础表达式运算-赋值表达式
 */
export function assign_expression_001_T(taint_src : string) {
  let t = taint_src;
  taint.Sink(t);
}