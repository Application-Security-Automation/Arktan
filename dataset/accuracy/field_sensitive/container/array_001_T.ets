import { taint } from "../../../../pages/taint"

/**
 * Introduction 数组索引
 */
export function array_001_T(taint_src : string) {
  let arr = [taint_src, "b", "c"]
  taint.Sink(arr[0]);
}