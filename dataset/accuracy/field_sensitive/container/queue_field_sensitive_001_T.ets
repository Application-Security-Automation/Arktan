import Queue from "@ohos.util.Queue";
import { taint } from "../../../../pages/taint";

/**
 * Introduction Queue域敏感
 */
export function queue_field_sensitive_001_T(taint_src : string) {
  let s = new Queue<string>();
  s.add(taint_src);
  s.add("clean");
  taint.Sink(s.getFirst());
}