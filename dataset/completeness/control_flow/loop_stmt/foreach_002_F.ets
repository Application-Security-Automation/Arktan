import { taint } from "../../../../pages/taint";

/**
 * Introduction 循环结构-循环体-foreach
 */
export function foreach_002_F(taint_src : string) {
  let clean = ""
  let _t = taint_src;
  let arr = ["a", "b", clean];
  arr.forEach(item => {
    taint.Sink(item);
  })
}