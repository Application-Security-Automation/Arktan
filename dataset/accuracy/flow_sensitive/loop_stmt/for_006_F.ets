import { taint } from "../../../../pages/taint"
/**
 * Introduction 循环结构-for
 */

export function for_005_T(taint_src : string) {
  let res = ""
  let i = 0
  for (; i < 1; taint.Sink(res)) {
    res = taint_src
  }
}