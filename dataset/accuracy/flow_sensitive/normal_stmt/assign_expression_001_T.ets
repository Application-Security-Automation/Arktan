import { taint } from "../../../../pages/taint"
/**
 * Introduction 流敏感-常规语句-赋值表达式
 */

export function assign_expression_001_T(taint_src : string) {
  let result = taint_src
  taint.Sink(result)
}