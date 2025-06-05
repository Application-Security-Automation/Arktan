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
    config.buildFromProjectDir('/Users/sevencold/Study/ArkTS_project/ptatest');
    config.getSdksObj().push(sdk);
    let projectScene: Scene = new Scene();
    projectScene.buildSceneFromProjectDir(config);
    projectScene.inferTypes();
    let pta = new MyPointerAnalysis(projectScene);
    pta.start();
}

run();
