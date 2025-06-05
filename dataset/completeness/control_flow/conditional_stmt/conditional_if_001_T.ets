import { taint } from "../../../../pages/taint";

/**
 * Introduction 条件语句-if
 */
export function conditional_if_001_T(taint_src : string) {
  if (true) {
    taint.Sink(taint_src)
  } else {}
}