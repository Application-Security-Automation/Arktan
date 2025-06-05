import { taint } from "../../../../pages/taint";

/**
 * Introduction 基础表达式运算-赋值表达式
 */
export function assign_expression_002_F(taint_src : string) {
  let _t = taint_src;
  let clean = "clean";
  taint.Sink(clean);
}