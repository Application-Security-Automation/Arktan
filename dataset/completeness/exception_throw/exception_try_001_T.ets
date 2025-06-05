import { taint } from "../../../pages/taint";
/**
 * Introduction 异常抛出-try块
 */

export function exception_try_001_T(taint_src : string) {
  try {
    taint.Sink(taint_src);
  } catch (e) {}
}