import { SceneConfig, Sdk } from "../Arkanalyzer/Config";
import { Scene } from "../Arkanalyzer/Scene";
import { MyPointerAnalysis } from "./Mypta/MyPointerAnalysis";


let sdk: Sdk = {
    name: 'ohos',
    path: '',
    moduleName: ''
};
let config: SceneConfig = new SceneConfig()
function run(projectname: string) {
    //let projectdir: string = "/Users/sevencold/Study/ArkTS_project/ptatest"; // arkts项目目录
    let projectdir: string = "/Users/sevencold/Downloads/" + projectname; // arkts项目目录
    config.buildFromProjectDir(projectdir);
    config.getSdksObj().push(sdk);
    let projectScene: Scene = new Scene();
    projectScene.buildSceneFromProjectDir(config);
    projectScene.inferTypes();
    let pta = new MyPointerAnalysis(projectScene);
    pta.start();
}

function formatMB(bytes: number): string {
    return (bytes / 1024 / 1024).toFixed(2) + 'MB';
}

// function printMemoryDetail(label: string, mem: NodeJS.MemoryUsage) {
//     console.log(`  ${label}:`);
//     console.log(`    RSS (常驻内存):     ${formatMB(mem.rss)}`);
//     console.log(`    堆总大小:          ${formatMB(mem.heapTotal)}`);
//     console.log(`    堆已使用:          ${formatMB(mem.heapUsed)}`);
//     console.log(`    堆外内存 (RSS-堆):  ${formatMB(mem.rss - mem.heapTotal)}`);
//     console.log(`    ArrayBuffers:      ${formatMB(mem.arrayBuffers || 0)}`);
// }

let projectnames = ["harmony-utils-master","YaoYaoLingXian-master","HarmonyOS-App-Development-main","CoolMallArkTS-main","agc-HarmonyOS-demos-master"];
projectnames.forEach(name => {
    console.log(`\n========== 开始分析: ${name} ==========`);
    
    // 强制GC（如果可用）
    try { global.gc?.(); } catch {}
    
    const memBefore = process.memoryUsage();
    const start = Date.now();
    
    run(name);
    
    const elapsed = Date.now() - start;
    const memAfter = process.memoryUsage();
    
    console.log(`\n📊 ${name} 分析结果:`);
    console.log(`⏱️  耗时: ${elapsed}ms`);
    // console.log(`\n--- 分析前内存 ---`);
    // printMemoryDetail('分析前', memBefore);
    // console.log(`\n--- 分析后内存 ---`);
    // printMemoryDetail('分析后', memAfter);
    // console.log(`\n--- 增量 ---`);
    console.log(`  RSS 增长:     ${formatMB(memAfter.rss - memBefore.rss)}`);
   })