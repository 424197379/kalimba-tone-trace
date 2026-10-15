# 外部导入：拒绝静默丢失内置伴奏字段

2026-10-12，本地 2.4.23 导入边界修正。范围只涉及新 JSON 导入、实际可复制 AI 提示词、相关测试与说明，不新增播放层或迁移既有曲库。

## 原问题与当前行为

内置 V2 资料及历史存储读取可以保留可选 `practiceAccompaniment`。外部导入构建流程只支持 `autoAccompaniment`，此前原样上传内置伴随资料时，会保留旋律和 `sourceFeatures` 说明，却忽略顶层的 `practiceAccompaniment` 播放数据。这使成功导入看起来完整，实际少了音乐。青花瓷旧回归曾明确记录这条路径，它现在改为拒绝回归。

当前新导入在展开批量包装器与生成曲目之前检查该保留字段：

- 单首歌曲、JSON 数组的每个歌曲对象，以及 `{ "songs": [...] }` 包装器根对象，都检查自身顶层 `practiceAccompaniment`。
- 使用 `Object.hasOwn`，以字段存在为准。合法对象、`null`、`false`、`0`、空字符串、数组、空对象、空 `events` 和其他非法值都拒绝，不因没有可读音符就放行。
- 同时已有 `autoAccompaniment` 也拒绝。解析器不会重命名、合并、覆盖、比较后择一，或优先选择任何一层。
- `sourceFeatures.practiceAccompaniment` 仍是合法来源/复核元数据；其他元数据不因名称未知而被一并拒绝。元数据的保留不等于支持音会播放。
- 合法 `autoAccompaniment`、没有保留字段的 V2、V1 `steps` 和旧 `notation` 路径继续可用。
- 不把严格新导入规则加进 `normalizeStoredSong`。内置播放与既有本地存储的容错读取不变，不重写或迁移原始记录。

这不是对所有未知字段的通用拒绝，也不是新的外部伴奏 schema。被拒绝的是一个已知会被导入投影静默丢弃、且具有播放含义的字段。

## 错误信息与正确修复

错误会明确定位顶层 `practiceAccompaniment` 是内置专用字段，并指向现有 `schemaVersion: 2` / `autoAccompaniment` 格式。修复要求是核对完整导入表示，不是只删除字段：

1. 确定来源、选段、主旋律及要保留的伴奏编配。完整保存输入资料供对照。
2. 对选定伴奏逐项保留音名、角色、所有独立起音、`beat`、`duration`、`velocity`、事件模式，以及 `volume`、`enabledByDefault`。没有谱源依据时不能添加、删除或改写音乐来通过校验。
3. 保留原旋律时间轴、BPM、源结束拍 `sourceFeatures.sourceTotalBeats`，以及 `rhythm.restWindows` 的完整位置、长度、`silent`/有据 `hold` 政策。不能裁短原持续音、抹去最后休止或把静音改成 `hold` 规避冲突。
4. 经核对后，使用支持的 `autoAccompaniment` 表示同一完整所选伴奏，输出不含顶层内置字段的外部 V2 稿。仅在说明中留一份同名元数据不能替代音符。
5. 若原资料同时已有两层，先明确两层关系及用户实际要采用的编配；不能仅改名覆盖已有 auto，也不能拼成混播或擅自丢掉一层。无法确定时先补资料或询问选版。
6. 导入后核对所有目标和支持起音、总长与休止，再分别做源谱比较和试听。结构成功只说明可计算约束通过，不保证转谱忠实。

三个来源专测的外部表示只在内存明确选用各自唯一的已知支持层，且逐项断言完整保存。它们不是用户文件的自动转换功能，也没有授权对任意双层资料套用同一转换。

## AI 提示词与真实入口

`src/song-store.js` 的实际 `AI_SONG_PROMPT` 增加外部字段边界，明确禁止顶层 `practiceAccompaniment`，说明 null/空值也会拒绝、完整转换和双层冲突处理，并区分合法来源元数据。原有的谱源、角色、延音/重复起音、连音比例、升降音、休止与不保证零错谱的要求保留。

`src/song-library.js` 的提示词文本框和复制按钮仍读取同一个常量。可复制四拍示例不包含内置字段，仍可被真实解析器接受；没有通过另做一个未接入页面的提示词来代替实际修改。

真实保存流程先完成整个批次解析，再调用保存和当前曲目选择。任一歌曲或包装器因该字段失败，已有本地曲库、当前曲目、筛选、搜索、其他偏好不改变；输入框保留原文供修复，忙碌状态退出，页面显示错误。不会把批次前半段有效歌曲先保存。

## 回归覆盖与已执行结果

执行：

```sh
node --test scripts/test-import-score-contract.mjs scripts/test-porcelain-reviewed-support.mjs scripts/test-see-you-reviewed-support.mjs scripts/test-jingle-reviewed-support.mjs scripts/test-song-store.mjs
```

实现阶段最终运行 **82/82 通过**，包括：

- 新导入契约 19 项：每个保留字段值、三种输入容器、批量根字段、同时存在 auto、只出现在说明中的同名字段、其他元数据、合法 V2/V1/notation。
- 真实 `importSongFromJson` 函数的内存执行：单首失败、有效/无效混合两种顺序、批量包装器歌曲失败、包装器根字段失败，均无存储写入、无当前曲目切换、无部分保存、保留输入并结束忙碌状态。
- 支持 auto 的显式转换/存储/读取正例：精确三连音和独立重复起音、完整多音伴奏、已有下声部持续穿过 `hold`、末尾 `silent`、4 拍源总长及全部开关/音量设置保留。
- 历史本地 V2 的两层支持读取和三首内置轻伴奏仍存在，原始存储字节不改；同一历史对象作为“新上传”时才被严格拒绝。
- 青花瓷原样拒绝，同时支持外部 auto 表示保留 83 个目标、15 根音与精确 m39 `hold`；错误 `silent` 仍拒绝。
- See You Again 原样拒绝，同时支持外部 auto 表示保留 86 个目标、24 次低声部起音。
- 铃儿响叮当原样拒绝，同时支持外部 auto 表示保留 51 个目标、16 根音。
- 三首源数据、旋律、支持与档案的原精确 hash/起音断言未放松；内置资料总数和练习卡数量仍由专测保护。

另外执行 `npm run test:compiler-skill`：**15/15 通过**；`node --check src/song-store.js`、`node --check scripts/test-import-score-contract.mjs` 和 `git diff --check` 通过。测试只使用内存存储，不修改用户浏览器数据。

这里记录的是实现阶段聚焦回归。全量构建/检查、真实浏览器复制与保存、Service Worker 更新和独立复核由本轮集成验证记录另行说明，不用这 82 项代替。此次未做新的源图解读、主观参考试听或实体琴验收，不改变任何歌曲的音乐核准状态。

## 历史证据与冻结数据

`VERIFY_2.4.21.md` 等历史日志、冻结曲目中的历史 `importBoundary` 描述及旧来源证据继续按原字节保留，反映当时真实观察，不重写成“过去已经拒绝”。当前规则以本文件、导入代码和更新后的 compiler schema 为准。

来源说明中的当前边界已同步：

- [PORCELAIN_ROOT_SUPPORT.md](PORCELAIN_ROOT_SUPPORT.md)
- [SEE_YOU_LIGHT_SUPPORT.md](SEE_YOU_LIGHT_SUPPORT.md)
- [JINGLE_ROOT_SUPPORT.md](JINGLE_ROOT_SUPPORT.md)

本修正不改任何 `data/songs`、`data/archives` 或生成曲库，不新增音频、不调整伴奏借用策略，不改变已有用户的伴奏选择，也不包含 push、部署或公开发布。
