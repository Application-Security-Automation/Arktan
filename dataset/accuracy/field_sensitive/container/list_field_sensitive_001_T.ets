import List from "@ohos.util.List";
import { taint } from "../../../../pages/taint";

/**
 * Introduction List域敏感
 */
export function list_field_sensitive_001_T(taint_src : string) {
  let l = new List<string>();
  l.add(taint_src);
  l.add("clean");
  taint.Sink(l.get(0));
}