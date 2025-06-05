import { taint } from "../../../../pages/taint"
/**
 * Introduction 函数重载-构造函数-super
 * Level 2
 */

export function constructor_extends_002_F(taint_src : string) {
  let _t = taint_src;
  let _clean = "clean";

  let derived = new DerivedClass(_clean)
  derived.process()
}
class BaseClass {
  data : string
  constructor(t : string) {
    this.data = t
  }

  getData() {
    return this.data
  }

  process() {}
}

class DerivedClass extends BaseClass {
  constructor (t : string) {
    super(t)
  }

  process () {
    taint.Sink(this.getData())
  }
}