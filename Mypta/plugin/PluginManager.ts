import { ArkMethod } from "../../../src/core/model/ArkMethod";
import { CallEdge } from "../CallEdge";
import { MyPointerAnalysis } from "../MyPointerAnalysis";
import { Plugin } from "./Plugin"
export class PluginManager implements Plugin{
    private allPlugins : Plugin[];
    private onNewCallEdgePlugins : Plugin[];
    private onNewMethodPlugins : Plugin[];
    constructor() {
        this.allPlugins = new Array();
        this.onNewCallEdgePlugins = new Array();
        this.onNewMethodPlugins = new Array();
    }
    setSolver(solver: MyPointerAnalysis): void {
        this.allPlugins.forEach(p => p.setSolver?.(solver));
    }
    addPlugin(plugin : Plugin) {
        this.allPlugins.push(plugin);
        this.addonNewMethodPlugin(plugin, this.onNewMethodPlugins, "onNewMethod");
        this.addonNewCallEdgePlugin(plugin, this.onNewCallEdgePlugins, "onNewCallEdge");
    }
    addonNewCallEdgePlugin(plugin: Plugin, plugins: Plugin[], name: string) {
        if(name in plugin) {
            plugins.push(plugin);
        }
    }
    addonNewMethodPlugin(plugin: Plugin, plugins: Plugin[], name: string) {
        if(name in plugin) {
            plugins.push(plugin);
        }
    }
    onStart(): void {
        this.allPlugins.forEach(p => p.onStart?.());
    }
    onFinish(): void {
        this.allPlugins.forEach(p => p.onFinish?.());
    }
    onNewCallEdge(edge: CallEdge): void {
        this.onNewCallEdgePlugins.forEach(p => p.onNewCallEdge?.(edge));
    }
    onNewMethod(method: ArkMethod): void {
        this.onNewMethodPlugins.forEach(p => p.onNewMethod?.(method));
    }
}

