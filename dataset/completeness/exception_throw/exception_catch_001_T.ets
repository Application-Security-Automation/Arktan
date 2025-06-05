import { taint } from "../../../pages/taint";
/**
 * Introduction 异常抛出-catch块
 */

export function exception_catch_001_T(taint_src : string) {
  try {
    throw new Error();
  } catch (e) {
    taint.Sink(taint_src);
  }
}