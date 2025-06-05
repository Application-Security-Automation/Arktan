import { taint } from "../../../../pages/taint";
/**
 * Introduction 模板字面量
 */

export function template_literal_002_F(taint_src : string) {
  let _t = taint_src;
  let t = "_";
  let clean =`_${t}`;
  taint.Sink(clean);
}