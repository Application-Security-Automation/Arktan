export class TaintFlow {
    private sourcepoint : string;
    private sinkpoint : string;
    constructor(sourcepoint : string, sinkpoint : string) {
        this.sourcepoint = sourcepoint;
        this.sinkpoint = sinkpoint;
    }
    toString() : string {
        return "Taintflow{" + this.sourcepoint + " -> " + this.sinkpoint + "}"
    }
}