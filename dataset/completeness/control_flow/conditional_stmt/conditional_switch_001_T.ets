import { taint } from "../../../../pages/taint";

/**
 * Introduction 条件语句-switch
 */
export function conditional_switch_001_T(taint_src : string) {
  switch (2) {
    case 2:
      taint.Sink(taint_src)
  }
}