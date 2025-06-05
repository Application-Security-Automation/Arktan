import { taint } from "../../../../pages/taint";
/**
 * Introduction 模板字面量
 */

export function template_literal_001_T(taint_src : string) {
  let t =`_${taint_src}`;
  taint.Sink(t);
}