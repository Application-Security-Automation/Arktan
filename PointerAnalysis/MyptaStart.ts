import { SceneConfig, Sdk } from "../Arkanalyzer/Config";
import { Scene } from "../Arkanalyzer/Scene";
import { MyPointerAnalysis } from "./Mypta/MyPointerAnalysis";


let sdk: Sdk = {
    name: 'ohos',
    path: '',
    moduleName: ''
};
let config: SceneConfig = new SceneConfig()
function run() {
    let projectdir: string = "/Users/sevencold/Study/ArkTS_project/ptatest"; // arkts项目目录
    config.buildFromProjectDir(projectdir);
    config.getSdksObj().push(sdk);
    let projectScene: Scene = new Scene();
    projectScene.buildSceneFromProjectDir(config);
    projectScene.inferTypes();
    let pta = new MyPointerAnalysis(projectScene);
    pta.start();
}

run();
