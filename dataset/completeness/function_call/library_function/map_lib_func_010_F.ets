import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-map_keys
 */
export function map_lib_func_010_F(taint_src : string) {
  let map = new Map<string,string>();
  map.set("_","t");
  map.set("tt","a");
  taint.Sink(map.keys());
}