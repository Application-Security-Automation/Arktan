import { taint } from "../../../pages/taint";
/**
 * Introduction 异常抛出-try块
 */

export function exception_try_002_F(taint_src : string) {
  try {
    let _t = taint_src;
    let clean = "_";
    taint.Sink(clean);
  } catch (e) {}
}