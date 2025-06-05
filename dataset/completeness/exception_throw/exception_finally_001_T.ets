import { taint } from "../../../pages/taint";
/**
 * Introduction 异常抛出-finally块
 */

export function exception_finally_001_T(taint_src : string) {
  try {}
  catch (e) {}
  finally {
    taint.Sink(taint_src);
  }
}