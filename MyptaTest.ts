import { SceneConfig } from "../src/Config";
import { Scene } from "../src/Scene";
import { MyPointerAnalysis } from "./Mypta/MyPointerAnalysis";



let config: SceneConfig = new SceneConfig()
function run() {
    config.buildFromProjectDir('D:\\ArktsProject\\ptatest');
    let projectScene: Scene = new Scene();
    projectScene.buildSceneFromProjectDir(config);
    projectScene.inferTypes();
    let pta = new MyPointerAnalysis(projectScene);
    pta.start();
}

run();
