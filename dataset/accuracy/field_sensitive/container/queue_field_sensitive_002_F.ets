import Queue from "@ohos.util.Queue";
import { taint } from "../../../../pages/taint";

/**
 * Introduction Queue域敏感
 */
export function queue_field_sensitive_002_F(taint_src : string) {
  let s = new Queue<string>();
  s.add("clean");
  s.add(taint_src);
  taint.Sink(s.getFirst());
}