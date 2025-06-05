import { CallSource } from "../CallSource";
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import { Scene } from "../../../Arkanalyzer/Scene";
import { ArkMethod } from "../../../Arkanalyzer/core/model/ArkMethod";
import { Sink } from "../Sink";
import { ParamSource } from "../ParamSource";
import { TaintTransfer } from "../TaintTransfer";
import { IndexRef } from "../IndexRef";
export class TaintConfig {
    private callsources : CallSource[];
    private paramsources : ParamSource[];
    private sinks : Sink[];
    private transfers : TaintTransfer[];
    private MethodsMap : Map<string, ArkMethod>;
    constructor(s: Scene, filePath: string) {
        this.MethodsMap = s.GetMethodsMap();
        this.callsources = new Array();
        this.sinks = new Array();
        this.paramsources = new Array();
        this.transfers = new Array();
        let IndexMap : Map<string, number> = new Map([["base",-1],["result",-2]]);
        try {
            const fileContents = fs.readFileSync(filePath, 'utf8');
            const ymlcontent = yaml.load(fileContents) as any;
            for(let i=0; i<ymlcontent.sources.length; i++) {
                if(ymlcontent.sources[i].kind === "call") {
                    let m = this.MethodsMap.get(ymlcontent.sources[i].method);
                    if(m != undefined) {
                        this.callsources.push(new CallSource(m,m.getReturnType()));
                    }
                }
                if(ymlcontent.sources[i].kind === "param") {
                    let m = this.MethodsMap.get(ymlcontent.sources[i].method);
                    if(m != undefined) {
                        let index = ymlcontent.sources[i].index as number;
                        this.paramsources.push(new ParamSource(m,m.getParameterInstances()[index].getType(),index));
                    }
                }
            }
            for(let i=0; i<ymlcontent.sinks.length; i++) {
                let m = this.MethodsMap.get(ymlcontent.sinks[i].method);
                if(m != undefined) {
                    this.sinks.push(new Sink(m,ymlcontent.sinks[i].index));
                }
            }
            for(let i=0; i<ymlcontent.transfers.length; i++) {
                let m = this.MethodsMap.get(ymlcontent.transfers[i].method);
                if(m != undefined) {
                    let from = IndexMap.get(ymlcontent.transfers[i].from);
                    let to = IndexMap.get(ymlcontent.transfers[i].to);
                    let fromindex = from != undefined ? new IndexRef(from) : new IndexRef(ymlcontent.transfers[i].from);
                    let toindex = to != undefined ? new IndexRef(to) : new IndexRef(ymlcontent.transfers[i].to);
                    this.transfers.push(new TaintTransfer(m,fromindex,toindex));
                }
            }
        } catch (e) {
            console.error('Error parsing YAML file:', e);
        }
    }
    getCallSources() : CallSource[] {
        return this.callsources;
    }
    getParamSources() : ParamSource[] {
        return this.paramsources;
    }
    getSinks() : Sink[] {
        return this.sinks;
    }
    getTaintTransfers() : TaintTransfer[] {
        return this.transfers;
    }
}