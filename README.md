**P-taintAnalysis4ArkTS**

本项目基于OpenHarmony中的开源项目Arkanalyzer设计的针对ArkTS应用的指针分析及污点分析。
用户可以通过设置污点配置文件（PointerAnalysis/Mypta/config/taint_config.yml）对ArkTS项目进行污点分析。
本项目还设计了类似于Tai-e分析框架的插件系统，用户可以通过添加插件完成特定的分析任务。

项目入口文件为PointerAnalysis/MyptaStart.ts，用户设置文件中的ArkTS项目目录即可进行项目分析。

目前可以分析大部分代码场景下的数据流，包括但不限于各种数据类型、各种表达式、类字段的存取、函数调用（变量调用函数、箭头函数、闭包、库函数）、数组等容器的存取等。

该分析框架还处于初步阶段，仅可对较为简单的ArkTS项目进行分析，后续将不断对其进行开发完善。
