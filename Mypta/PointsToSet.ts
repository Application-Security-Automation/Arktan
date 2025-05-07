import { Obj } from "./Obj";

export class PointsToSet {
    private set: Set<Obj>;
    constructor(set : Set<Obj>) {
        this.set = set;
    }
    public addObject(o: Obj) {
        this.set.add(o);
    }
    public addAll(pts: PointsToSet) {
        pts.getObjects().forEach(obj => {
            this.set.add(obj);
        });
    }
    public getObjects(): Set<Obj> {
        return this.set;
    }
    public addAllDiff(pts: PointsToSet) : PointsToSet |null {
        let diff : Set<Obj> = new Set<Obj>();
        pts.getObjects().forEach(obj => {
            if(!this.set.has(obj)) {
                diff.add(obj);
                this.set.add(obj);
            }
        });
        if(diff.size != 0)
            return new PointsToSet(diff);
        return null;
    }
}