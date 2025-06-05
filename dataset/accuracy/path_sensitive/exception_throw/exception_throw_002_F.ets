import { taint } from "../../../../pages/taint"
/**
 * Introduction 异常抛出-try块
 */

export function exception_throw_002_F(taint_src : string) {
  try {
    throw new Error()
    taint.Sink(taint_src)
  } catch (e) {
  }
}