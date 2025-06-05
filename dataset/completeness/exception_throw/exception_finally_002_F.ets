import { taint } from "../../../pages/taint";
/**
 * Introduction 异常抛出-finally块
 */

export function exception_finally_002_F(taint_src : string) {
  try {}
  catch (e) {}
  finally {
    let _t = taint_src;
    let clean = "_";
    taint.Sink(clean);
  }
}