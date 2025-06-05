import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-map_get
 */
export function map_lib_func_003_T(taint_src : string) {
  let map = new Map<string,string>();
  map.set("t",taint_src);
  taint.Sink(map.get("t")!);
}