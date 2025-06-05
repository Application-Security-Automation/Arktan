import { taint } from "../../../pages/taint";
/**
 * Introduction 异常抛出-catch块
 */

export function exception_catch_002_F(taint_src : string) {
  try {
    throw new Error();
  } catch (e) {
    let _t = taint_src;
    let clean = "_";
    taint.Sink(clean);
  }
}