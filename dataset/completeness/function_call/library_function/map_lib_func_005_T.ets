import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-map_entries
 */
export function map_lib_func_005_T(taint_src : string) {
  let map = new Map<string,string>();
  map.set("t",taint_src);
  map.set("tt","a");
  taint.Sink(map.entries());
}