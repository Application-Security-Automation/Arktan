import { taint } from "../../../../pages/taint"

/**
 * Introduction 数组索引
 */
export function array_004_F(taint_src : string) {
  let arr = [[taint_src], ["b"], "c"]
  taint.Sink(arr[1][0]);
}