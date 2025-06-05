import { taint } from "../../../pages/taint";
/**
 * Introduction 异步-Promise-then
 */

export function promise_callback_001_T(taint_src : string) {
  let p = f(taint_src);
  p.then((result) => {
    taint.Sink(result);
  })
}
async function f(t : string): Promise<string> {
  return new Promise((resolve) => {
    resolve(t);
  });
}