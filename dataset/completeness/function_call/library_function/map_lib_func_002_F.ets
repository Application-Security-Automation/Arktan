import { taint } from "../../../../pages/taint";


/**
 * Introduction 库函数-map_set
 */
export function map_lib_func_002_F(taint_src : string) {
  let map = new Map<string,string>();
  map.set("t","_");
  taint.Sink(map);
}