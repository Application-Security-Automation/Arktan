import { taint } from "../../../../pages/taint";

/**
 * Introduction lambda表达式
 */
export function lambda_expression_001_T(taint_src : string) {
  let lambda1 = (a:string) => a;
  let t = lambda1(taint_src);
  taint.Sink(t);
}