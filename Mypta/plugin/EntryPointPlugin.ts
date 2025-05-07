import { DummyMainCreater } from "../../../src/core/common/DummyMainCreater";
import { MyPointerAnalysis } from "../MyPointerAnalysis";
import { Plugin } from "./Plugin";

export class EntryPointPlugin implements Plugin {
    private solver! : MyPointerAnalysis;
    setSolver(solver: MyPointerAnalysis): void {
        this.solver = solver;
    }
    onStart(): void {
        //处理入口方法
        const dummyMainCreator = new DummyMainCreater(this.solver.scene);
        dummyMainCreator.createDummyMain();
        const dummyMainMethod = dummyMainCreator.getDummyMain();
        this.solver.cg.addEntryMethods(dummyMainMethod);
        this.solver.entryPoints.push(dummyMainMethod);
        // const methods = this.solver.scene.getMethods();
        // methods.forEach(m => {
        //     if(m.getName() === "main") {
        //         this.solver.cg.addEntryMethods(m);
        //         this.solver.entryPoints.push(m);
        //     }
        // });
    }
}