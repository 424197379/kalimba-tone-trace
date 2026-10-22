import { NOTE_INDEX, SONG_LIBRARY } from "./songs.js";

export const APP_VERSION = "2.4.55";
export const CURRENT_SONG_STORAGE_KEY = "kalimba-current-song";
export const CUSTOM_SONGS_STORAGE_KEY = "kalimba-custom-songs-v1";
export const DIFFICULTY_LEVELS = ["easy", "medium", "hard"];
export const DIFFICULTY_LABELS = {
  all: "全部",
  easy: "简单",
  medium: "中等",
  hard: "困难"
};

const DIFFICULTY_ALIASES = new Map([
  ["easy", "easy"],
  ["simple", "easy"],
  ["beginner", "easy"],
  ["1", "easy"],
  ["简单", "easy"],
  ["容易", "easy"],
  ["入门", "easy"],
  ["初级", "easy"],
  ["medium", "medium"],
  ["normal", "medium"],
  ["moderate", "medium"],
  ["2", "medium"],
  ["中等", "medium"],
  ["普通", "medium"],
  ["中级", "medium"],
  ["hard", "hard"],
  ["difficult", "hard"],
  ["advanced", "hard"],
  ["3", "hard"],
  ["困难", "hard"],
  ["难", "hard"],
  ["高级", "hard"]
]);

const DEGREE_TO_NOTE = {
  1: "C",
  2: "D",
  3: "E",
  4: "F",
  5: "G",
  6: "A",
  7: "B"
};

const NOTE_ROLES = new Set(["melody", "harmony", "bass", "arpeggio", "ornament"]);
const ARRANGEMENT_KINDS = new Set(["melody", "chord"]);
const JUDGEMENT_MODES = new Set(["melody", "chord"]);
const RHYTHM_SOURCE_STATUSES = new Set(["verified", "inferred", "needs-review"]);
const RHYTHM_REST_POLICIES = new Set(["silent", "hold"]);
const ACCOMPANIMENT_MIN_VELOCITY = 0.05;
const ACCOMPANIMENT_MAX_VELOCITY = 1.2;
const MELODY_VERSION_LABEL = "主旋律版";
const CHORD_VERSION_LABEL = "和弦版";

export const AI_SONG_PROMPT = `请根据我提供的简谱照片、谱源或指定歌曲版本，制作可被卡林巴循音 App 导入的乐谱。

资料足够且核心旋律、节奏能可靠确认时，只输出一个 schemaVersion: 2 的纯 JSON 对象，不要 Markdown、代码块、注释或尾随逗号。关键音高、时值、连线性质、版本或选段不清楚时，先交叉查证；仍不能确认就问我具体缺少的材料，不要猜一份可导入的 JSON。JSON 结构通过校验不代表转谱正确，不能保证零错谱。

同一个 JSON 对象内每个字段名只能出现一次，转义写法解码后同名也算重复；即使值相同或只是来源元数据，也不能重复。不同音符、事件或歌曲各自的对象使用同名字段是合法的。发现重复字段时，保留完整原稿，对照两处内容与谱源整理；不能擅自取最后一份、自动合并或直接删除而丢失旋律、伴奏或整首歌。App 会拒绝整批新导入并标明位置，修正后再导入；它不会替你判定哪份音乐正确。

目标：固定 21 音 C 调卡林巴，用户在实体琴上跟弹单音主旋律。支持的音名只有 F3、G3、A3、B3、C4、D4、E4、F4、G4、A4、B4、C5、D5、E5、F5、G5、A5、B5、C6、D6、E6。
先按原谱调号、临时升降号和八度读谱，再选择保持音程的整体转调，输出 key: "C"、tuning: "21-key-c"。不能把必要的升降音改成邻近自然音，也不能为了凑音域逐音改八度。若整体转调或整体移八度仍不能忠实表达，就提出可保真的选段或说明此版本不适合这把琴，等我确认；不得冒充原曲制作改音版。长音本身不是不适合卡林巴的理由。

外部导入字段边界：可播放的独立伴奏只放在受支持的 autoAccompaniment；禁止输出顶层 practiceAccompaniment，它是内置曲库专用播放字段，新导入会明确拒绝，即使值为 null 或空对象也不接受。遇到包含该字段的原资料，先核对完整伴奏音符、beat、duration、音量、默认开关、主旋律时间轴、rhythm.restWindows 的 silent/hold 策略和 sourceFeatures.sourceTotalBeats，再整理成 schemaVersion: 2 的受支持导入稿；不能仅删除字段而丢失伴奏。若原资料同时已有 autoAccompaniment，先核对两层内容并明确采用的编配，不能自动合并、改名或擅自选层；无法确认就问我。sourceFeatures.practiceAccompaniment 可以保留来源与复核说明，但它只是元数据，不会播放伴奏。界面“导入伴奏”仅说明来自导入资料，不代表应用已减配、校准和声或降低音量；请单独核对起音密度、完整时长和实际音量。

先做谱源核对，再做 JSON 结构检查：
1. 确认歌曲、版本和实际选段。谱图标题或署名与网页目录冲突时，先核实所选固定图像的版别并记录矛盾，不能混用歌手或编配标签。先核对无伴奏主旋律，逐句检查音高轮廓、起音、节奏、弱起、休止和结尾。图片模糊或不全时，可检索同版本清晰简谱、五线谱、MusicXML、MIDI 或演奏参考；和弦表不能证明主旋律音高与节奏。没有检索或看过的来源不得声称已核对。同一编配的简谱与五线谱也可能有转写差异，不能当作两个独立来源；休止或连线冲突须查看两者具体声部与端点并记录取舍，不能一律认定某种记谱更正确。若清晰谱与已有数据或另一版本冲突，明确本次采用哪份谱的哪一段，保留差异与未核来源；不能悄悄拼接版本，也不能把单一来源差异说成所有版本都错。两个曲库版本共享同一旋律不算独立证据；音高与时值对应未厘清，不能仅改拍号或分组就称已校准。多版本只有局部证据一致时，可以明确限定修正该处；其余冲突保留待核，不能因局部一致宣称整段或全曲正确。已有待核对照不是已选版本，没有新证据或明确选版时，不把对照候选直接替换原曲。
2. 严格区分低音点、高音点、时值附点、节奏下划线、拍号和连线；1=C 附近上下叠写的 4/4 是拍号。只有谱源确认同音高、相邻且由延音线连接的音，才合并为一次起音并相加 duration。连续多条延音线须逐个核端点，整条同音链只起音一次，链外独立同音仍须重拨。异常大跳只触发八度/版本复核，不能证明谱错；无法确认谱者意图时说明冲突并补资料，不凭熟悉旋律添八度点。跨行或跨小节的连线须检查前后端点；已确认延音的总时值可以跨过小节线，不能到新小节就重新起音。相邻同音不等于延音，真正重复拨音必须保留；不能只因相同音高就合并。不同音高的圆滑线保留每个音的独立起音。不得为了卡林巴衰减补造重复拨音或延音。
3. beat 从 0 开始，duration 以拍为单位，均写有限 JSON 数字。按谱保留切分、附点、十六分音符与连音比例。小号倚音不自动规定固定拍值，先分清无定量装饰音与有明确节奏的小音符；小号数字与连音组号须按字号、位置及连线覆盖对象分别确认，不能见到小3就当三连音。倚音弯钩不等于低八度点，附近主音的低点也不能借给小音符，逐次检查。波音或颤音记号未必列出确定附属音及拍值，不能自动展开成固定装饰音事件；明确省略时要标明位置并保留主音完整时序。不能猜时值、偷减主音或推迟后续起音。已明确采用省略装饰音的练习版时，保留主音完整时序，在 hint 与 sourceFeatures 中注明具体省略位置；若装饰实现不可缺少或取舍未定，先补证据或确认版本，不能暗中省略。三连音用足够精度的小数，例如三音占 1 拍时，起点 0、0.3333333333333333、0.6666666666666666，每音 duration 为 0.3333333333333333；三音占半拍时每音为 0.16666666666666666。先看原音符时值与减时线，再结合连音数字确定总时值，不能看到“3”就一律当成一拍。不要强制规整到 0.25 拍网格，也不能把 JSON 数字写成 1/3 表达式。真实的 0.25、0.5 等时值仍然有效。延长记号不规定固定多几拍；固定拍练习若选择延长，须明确记载实现方式，并一致移动后续旋律与伴奏，不能机械当成多写拍或拼入另一版本的尾休止。若定拍练习选择不额外延长，也须在 hint 与 sourceFeatures 明说，不能把名义拍数称为演唱的精确时长。逐小节对照减时线与拍数，不能把相似歌词或前句节奏套到后句；即使后句就在同一页，也须逐次核对音区、节奏和连线，不能因旋律相似直接复制前句。小节拍数仅作复核线索，弱起、延长和变拍须按所选谱解释。
4. 休止用时间空档表达，不生成休止音符。呼吸逗号或分句标记不等于定量休止，不能凭此缩短原音或插入猜测的空拍。sourceFeatures.sourceTotalBeats 记录所选谱段实际结束拍，包含弱起之后的全部时间与最后休止，不能只用末音结束拍代替；末音按原时值结束，不得拉长它伪装结尾休止。使用编谱报告时区分旋律末拍与所选谱段总拍；旧totalBeats仅指旋律末拍，旧gaps不含尾部空档。读取所选总长须同时检查来源声明及状态，推算的旋律空档不能自动证明原谱休止、其他声部静音或采样已经停止。省略括号间奏时，区分整页总拍与保留旋律总拍，不将间奏记成休止；多行歌词本身不等于反复指令；同页确实另列的完整回归段也不能因前段已熟悉就省略。只有实见反复记号及一、二房子才按对应路线展开；真正指回同一印刷段可以复用该段，另行印出的尾声仍须逐次核读。自行计数的小节号须注明并非原谱印号。比较不同版本先对齐拍号、四分音符拍单位、延音音头与实际主题范围；总拍数少一半不必然代表删去一半旋律，不能据此擅自加倍时值或混用另一版速度。选段先确认完整且连贯的主题范围；不能只为减少音符任意截短熟悉的主歌或副歌。同一版本相似句的连线和重弹须逐次读谱，不复制前句；被省略的器乐前奏与保留的人声休止分别说明。弱起、反复展开、变拍及选段起止在 sourceFeatures 中说明；当前 beatsPerMeasure 仍是单一数值，变拍须记录原谱小节与真实拍位置；可用 sourceFeatures.meterDisplay 表示已核实的拍号变化（例如“3/4 → 4/4”），它只作曲卡标签，不改变播放或循环时序，也不证明未核音符正确。不能因此改动真实 beat。
5. 每个 events 事件必须有且只有一个明确的 role: "melody" 音，设置 judge: true。同一拍只能有一个主旋律起音，不把最高音、首个音、低音或分解和弦猜成旋律。 选取钢琴上声部等明确旋律线时须注明实际声部与范围，不能冒称已核准人声；短版只缩短练习范围，不自动代表音域、密度或跳进变简单。多声部中的升降号须先定位声部，不能仅凭伴奏升音就认定主旋律不适配。新版输出使用 arrangementKind: "melody"、judgementMode: "melody"、versionLabel: "主旋律版"；App 的跟弹目标始终是单音。若保留同起点和声资料，其他音必须标正确 role 并设置 judge: false；独立伴奏起音放入 autoAccompaniment，不能伪装成 melody 事件。
6. 主旋律可靠后才考虑可选自动伴奏。没有可靠和声依据就省略，不能让伴奏掩盖错谱。和弦符号须按弱起、延长、反复与一二房子展开后的时间轴定位；第二遍不能机械照抄第一房子的和声。它能支持稀疏配音，却不等于原谱写明了精确伴奏拨法。 根音减配须明示省略的和声色彩，不把未演奏的半音改为自然音或冒称完整和弦；筛掉越界音后仍须检查强拍、句末与收束是否成立。新增伴奏建议 enabledByDefault: false，volume 约 0.3，音符 velocity 约 0.30–0.40，稀疏、轻声、不与主旋律同拍同音重复起音；用户已有明确选择时保留其选择。伴奏 notes 不写 judge，不要求用户弹实体和弦。两层来源的旋律、和声或时点冲突时，保留冲突说明并暂停该伴奏，不能盲目混播。 检查已有资料中的每个伴奏层，不只检查原自动伴奏；逐项比较完整书面时长与空档，区分推算的旋律空档、明确全层静音、改编省略和有源持续伴奏。报告没有冲突不代表和声正确，也不授权裁掉采样自然余音。改用短版或另一编配后，不能只凭同名或相同歌曲 id 沿用旧伴奏；先比对明确主旋律的音高、起拍、时长、速度及含尾休止的总拍，再核和声。内容相同只说明时间线兼容，不证明伴奏音乐正确。替换已有版本时，在开发归档或版本历史中保留原始数据及来源，确保修订可追溯、可逆；所选短版须明确标名和来源，不用另一版本填补缺页。未见原谱的后续相似句不能自动照前句改音、移八度或展开反复；每个采用范围都须有对应来源。
7. 主旋律 1 拍以上空档及末尾休止在 rhythm.restWindows 中标出。默认 policy: "silent"，窗口内不能放主旋律或自动伴奏，不能为了“丰满”填满呼吸。若空档来自明确省略实体和弦，须说明是单音改编的省略，不冒称原谱写了休止或其他声部也静音；保留原单音的真实时值，不将它拉长填满省略处。旋律休止不等于所有声部静音；若所选谱低声部确有持续，只保留有据的原起音和时长，不在休止内补一次拨音。刻意省略的伴奏不写成原谱休止，末端短低音不为丰满延长。policy: "hold" 仅用于谱源明确的伴奏延续，并写清依据；不能借此绕过静音检查或补造主旋律延音。所有事件、伴奏与休止窗口的结束拍均不得超过 sourceTotalBeats。含尾休止时必须给出合法总拍，不能删除真实休止来迎合只检查末音终点的旧校验。
8. 在 sourceFeatures.sources 或 rhythm.sources 记录实际使用的来源名称及可访问链接（用户图片可写页码/小节定位，不虚构 URL）；sourceFeatures.transcriptionScope 写实际范围，unsupported 写遗漏或乐器限制，unsureMeasures 写仍需核对的小节和原因。区分“已有谱源证据”“AI 推断”和“未核对”。rhythm.sourceStatus 只有节奏及休止有证据并完成逐句核对才写 "verified"，否则写 "inferred" 或 "needs-review"；它只描述节奏，不给旋律或和声背书。核心旋律/节奏仍不确定时应先问我，而不是靠此标签放行。

JSON 格式示例（仅演示四拍结构和最后一拍休止，不是已核对的真实歌曲，请用实际谱源替换）：
{
  "schemaVersion": 2,
  "title": "《格式示例》",
  "versionLabel": "主旋律版",
  "arrangementKind": "melody",
  "judgementMode": "melody",
  "bpm": 96,
  "beatsPerMeasure": 4,
  "defaultSpeedFactor": 0.85,
  "difficulty": "easy",
  "key": "C",
  "tuning": "21-key-c",
  "hint": "结构示例，尚未对照真实谱源；最后一拍保持休止。",
  "events": [
    { "beat": 0, "duration": 1, "notes": [{ "name": "E4", "role": "melody", "judge": true, "velocity": 1 }] },
    { "beat": 1, "duration": 0.5, "notes": [{ "name": "E4", "role": "melody", "judge": true, "velocity": 1 }] },
    { "beat": 1.5, "duration": 0.5, "notes": [{ "name": "D4", "role": "melody", "judge": true, "velocity": 1 }] },
    { "beat": 2, "duration": 1, "notes": [{ "name": "C4", "role": "melody", "judge": true, "velocity": 1 }] }
  ],
  "sourceFeatures": {
    "transcriptionScope": "四拍格式演示，非真实歌曲",
    "sourceTotalBeats": 4,
    "sources": [{ "label": "格式演示，无真实谱源" }],
    "unsupported": [],
    "unsureMeasures": ["示例内容尚未进行真实谱源核对"]
  },
  "rhythm": {
    "sourceStatus": "needs-review",
    "pickupBeats": 0,
    "restWindows": [{ "beat": 3, "duration": 1, "policy": "silent", "reason": "ending-rest" }]
  }
}

输出前检查：
- 批量导入报错时，按输入中的歌曲序号、标题及字段定位，保留完整原稿后修正；不能通过删掉报错歌曲或非法音来伪装成功。序号指输入歌曲，不是内部生成版本或音符序号。
- 每个音名都在支持列表中；role 只能是 "melody"、"harmony"、"bass"、"arpeggio"、"ornament"。不以删除非法音、替换自然音或更换 melody 角色来通过导入。
- beat >= 0，duration > 0，beat + duration 与 sourceTotalBeats 均有限；核对每小节拍数及全段总拍数，允许有谱源依据的非 0.25 拍时值。不要自动合并相邻重复音。
- 末尾静音、弱起和句间空档均保留。休止窗口不能与主旋律重叠，silent 窗口不能与伴奏重叠。
- 原谱有 BPM 时保留原速；缺失时可估计练习速度并注明推断，不冒充原谱速度。bpm 支持 40–220，defaultSpeedFactor 支持 0.35–1.4，慢练调整播放倍率，不篡改音符时值；defaultSpeedFactor 是曲谱建议，实际倍率以 App 的初次慢速及用户选择/记忆为准。核对时也检查 1.0x 基准速度。无法在当前范围保真表达的速度或拍号先说明限制。
- beatsPerMeasure 使用谱面拍号对应的每小节拍数（当前支持 2–8 的整数）；不清楚时先核对，不能为通过结构检查随意取整。difficulty 只能是 "easy"、"medium"、"hard"。
- 完成两层验收：先对照实际谱源确认音乐内容，再检查 JSON 音名、角色、有限时值、边界、休止和结构一致性。导入器只能检查可计算的矛盾，不能自动证明音高、延音线或节奏忠实，也不保证没有转谱错误。`;

export function readStoredSongId() {
  try {
    return localStorage.getItem(CURRENT_SONG_STORAGE_KEY);
  } catch (error) {
    console.warn("卡林巴循音 无法读取本地曲目", error);
    return null;
  }
}

export function storeSongId(songId) {
  try {
    localStorage.setItem(CURRENT_SONG_STORAGE_KEY, songId);
  } catch (error) {
    console.warn("卡林巴循音 无法保存本地曲目", error);
  }
}

function getCustomSongArray(strict = false) {
  try {
    const raw = localStorage.getItem(CUSTOM_SONGS_STORAGE_KEY);
    const parsed = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("本地曲库格式异常");
    }
    return parsed;
  } catch (error) {
    if (strict) {
      throw new Error("无法读取原有本地曲库，未修改已保存的数据。", { cause: error });
    }
    console.warn("卡林巴循音 无法读取本地曲库", error);
    return [];
  }
}

function saveCustomSongArray(songs) {
  try {
    localStorage.setItem(CUSTOM_SONGS_STORAGE_KEY, JSON.stringify(songs));
  } catch (error) {
    throw new Error("无法保存本地曲库，请检查浏览器存储权限或可用空间。", { cause: error });
  }
}

export function getSongBaseId(song) {
  return song.baseSongId || (/(?:-|_)chord$/.test(song.id) ? song.id.slice(0, -6) : song.id);
}

export function getSongVersionRank(song) {
  return song.arrangementKind === "chord" || song.judgementMode === "chord" ? 1 : 0;
}

// Optional source-backed display text only: never a meter map or timing input.
// Limit labels to up to eight quarter-note meters; ignore malformed/free text.
export function getSongMeterLabel(song) {
  const display = song?.sourceFeatures?.meterDisplay;
  const label = typeof display === "string" ? display.trim() : "";
  return /^[2-8]\/4(?: → [2-8]\/4){0,7}$/.test(label) ? label : `${song?.beatsPerMeasure}/4`;
}

// Practice always resolves to an existing melody counterpart before considering
// a derived fallback. The full library still holds arrangement/source records.
export function getPracticeSongs(library) {
  const songsByBaseId = new Map();
  for (const song of Object.values(library)) {
    if (getSongVersionRank(song) !== 0) continue;
    if (!song.steps.length || new Set(song.steps.map(([, beat]) => beat)).size !== song.steps.length) continue;
    if (!song.events.every((event) => event.notes.length === 1 &&
      event.notes[0].role === "melody" && event.notes[0].judge)) continue;
    const baseSongId = getSongBaseId(song);
    const current = songsByBaseId.get(baseSongId);
    if (!current || (song.id === baseSongId && current.id !== baseSongId)) {
      songsByBaseId.set(baseSongId, song);
    }
  }
  return [...songsByBaseId.values()];
}

export function getPracticeSongId(library, songId) {
  if (typeof songId !== "string" || !Object.hasOwn(library, songId)) return null;
  const baseSongId = getSongBaseId(library[songId]);
  return getPracticeSongs(library).find((song) => getSongBaseId(song) === baseSongId)?.id || null;
}

// Matching names/base ids do not establish a shared score timeline. Only borrow
// a sibling's support when its explicitly identified melody, tempo and extent
// match. This is compatibility evidence, not an endorsement of its harmony.
export function hasMatchingPracticeMelody(song, candidate) {
  const timeline = value => {
    if (Array.isArray(value?.events) && value.events.length) {
      const result = [];
      for (const event of value.events) {
        const melody = Array.isArray(event.notes) ? event.notes.filter(note => note.role === "melody") : [];
        if (melody.length !== 1 || melody[0].judge === false) return null;
        result.push([melody[0].name, event.beat, event.duration]);
      }
      return result;
    }
    return value?.schemaVersion === 1 && Array.isArray(value.steps) ? value.steps : null;
  };
  const first = timeline(song), second = timeline(candidate);
  if (!first?.length || !second?.length || first.length !== second.length ||
      !Number.isFinite(song.bpm) || song.bpm !== candidate.bpm) return false;
  const valid = steps => steps.every(step => Array.isArray(step) && NOTE_INDEX.has(step[0]) &&
    Number.isFinite(step[1]) && step[1] >= 0 && Number.isFinite(step[2]) && step[2] > 0);
  if (!valid(first) || !valid(second)) return false;
  const close = (a,b) => Math.abs(a-b) <= 1e-8;
  const end = (value, steps) => steps.reduce((max,[,beat,duration]) => Math.max(max,beat+duration),
    Number.isFinite(value.sourceFeatures?.sourceTotalBeats) ? value.sourceFeatures.sourceTotalBeats : 0);
  return close(end(song,first),end(candidate,second)) && first.every((step,index) =>
    step[0] === second[index][0] && close(step[1],second[index][1]) && close(step[2],second[index][2]));
}

// One selection contract for the practice control, remembered sound identity,
// library badge and initial duration. Imported backing is not reduced support.
// The optional original-only lookup preserves the existing comparison route.
export function getSongAccompanimentProvider(song, variants = [], originalOnly = false) {
  if (!song) return null;
  const siblings = variants.filter(candidate => candidate && candidate !== song &&
    getSongBaseId(candidate) === getSongBaseId(song))
    .sort((a, b) => getSongVersionRank(a) - getSongVersionRank(b) || a.id.localeCompare(b.id, "en"));
  const candidates = [song, ...siblings];
  if (!originalOnly) {
    const source = candidates.find(candidate => candidate.practiceAccompaniment?.events?.length &&
      hasMatchingPracticeMelody(song, candidate));
    if (source) return { song: source, config: source.practiceAccompaniment, kind: "light" };
  }
  if (song.source === "local") {
    const source = candidates.find(candidate => candidate.source === "local" &&
      candidate.autoAccompaniment?.events?.length && hasMatchingPracticeMelody(song, candidate));
    return source ? { song: source, config: source.autoAccompaniment, kind: "imported-auto" } : null;
  }
  // Built-in original-only backing keeps its existing session-only route. Never
  // cross into imported sources or bypass the sibling melody compatibility gate.
  const source = candidates.find(candidate => candidate.source !== "local" && candidate.autoAccompaniment?.events?.length &&
    (candidate === song || hasMatchingPracticeMelody(song, candidate)));
  return source ? { song: source, config: source.autoAccompaniment, kind: "original" } : null;
}

// Display-only wording for preserved melody editions that later gain compatible
// optional support. Check the actual selected provider before advertising it.
export function getSongPracticeHint(song, supportSource = null) {
  const fallback = String(song?.hint || "");
  const scope = song?.sourceFeatures?.sourceReview?.currentScopeReview;
  const approved = {
    "qing-hua-ci": ["reviewed-selected-piano-theme-excerpt", "eop-1676-simple-piano-upper-staff-m25-40",
      "qing-hua-ci-reviewed-support", "sparse15-downbeat-root-uniform-plus12"],
    "xuan-cao-hua": ["reviewed-selected-complete-vocal-edition", "shanshan-selected-c-complete-vocal-route",
      "xuan-cao-hua-reviewed-support", "sparse16-four-bar-chord-root"]
  };
  const identity = Object.hasOwn(approved, song?.id) ? approved[song.id] : null;
  if (!identity || scope?.status !== identity[0] || scope?.selectedEdition !== identity[1] ||
      supportSource?.id !== identity[2] || getSongBaseId(supportSource) !== song.id ||
      supportSource.sourceFeatures?.practiceAccompaniment?.candidate !== identity[3] ||
      !supportSource.practiceAccompaniment?.events?.length || !hasMatchingPracticeMelody(song, supportSource)) return fallback;
  return typeof supportSource.hint === "string" && supportSource.hint.trim() ? supportSource.hint.trim() : fallback;
}

// Exact archive lookup for developer history and recovery regressions only.
// Practice and library UI intentionally do not expose old-edition restoration.
export function getSongArchiveDownload(song) {
  const scope = song?.sourceFeatures?.sourceReview?.currentScopeReview;
  const archives = {
    jasmine: { status: "reviewed-selected-short-arrangement", filename: "jasmine-walter-v2.4.3.json", label: "旧长版 JSON · 可导入还原" },
    "ling-er-xiang-ding-dang": { status: "reviewed-selected-short-refrain", filename: "ling-er-xiang-ding-dang-v2.4.15.json", label: "旧49音版 JSON · 可导入还原" }
  };
  const baseId = getSongBaseId(song || {});
  const archive = Object.hasOwn(archives, baseId) ? archives[baseId] : null;
  if (!archive || scope?.status !== archive.status ||
      scope?.archiveImportPath !== `data/archives/${archive.filename}`) return null;
  return { href: `./data/archives/${archive.filename}`, filename: archive.filename, label: archive.label };
}

export function getSongReviewNotice(song) {
  const baseSongId = getSongBaseId(song);
  const limitations = Array.isArray(song.sourceFeatures?.unsupported)
    ? song.sourceFeatures.unsupported.join(" ")
    : "";
  if (baseSongId === "tian-kong-zhi-cheng" && /#4.*#5.*mapped to nearby natural notes/i.test(limitations)) {
    return "改音版：原主题含升4、升5，此版改成自然音；不作为原旋律保真练习，固定21音C调琴无法直接弹出这些半音。";
  }
  if (baseSongId === "interstellar-main-theme" && /44-49.*quantized to 0\.25/i.test(limitations)) {
    return "谱面待复核：第44–49小节三连音已简化为0.25拍；原谱第42小节起为4/4。";
  }
  const scopeReview = song.sourceFeatures?.sourceReview?.currentScopeReview;
  if (baseSongId === "tian-kong-zhi-cheng" && scopeReview?.status === "reviewed-continuous-mv-climax") {
    return "连续高潮选段：55音、65拍，原谱88 BPM，1倍速约44秒；不含熟悉的开头主题，无拼接、无改音，21音C调无需调音。原录音试听与实体演奏待确认。";
  }
  if (baseSongId === "tian-kong-zhi-cheng" && scopeReview?.status === "reviewed-selected-mv-excerpt") {
    return "MV短版：保留开头主题与后半段收尾，88 BPM、1倍速约1分22秒；跳过含升音的乐句，有两处剪接，21音C调无需调音。剪接听感与实体演奏待确认。";
  }
  if (baseSongId === "jue-bie-shu" && scopeReview?.status === "unresolved-full-script-melody-role") {
    return "待核版：保留现有334个单音；历史跨谱复核仅覆盖开头主题，15键脚本未单列旋律声部，全程单音取舍仍待核。完整脚本不等于完整旋律已核准。";
  }
  if (baseSongId === "ling-er-xiang-ding-dang" && scopeReview?.status === "reviewed-selected-short-refrain") {
    return "选用Coughlin 16小节短版副歌主题，51个单音、64拍；80 BPM为练习设定。可选同谱根音轻伴奏。";
  }
  if (baseSongId === "bluebird" && scopeReview?.status === "unresolved-simplified-chorus-source-mapping") {
    return "待核简化版：现有82音与明确旋律来源的对应尚未确认，保留旧音；不作为已核准原旋律或新手易弹推荐。";
  }
  if (baseSongId === "zhu-zhu-xia-theme" && scopeReview?.status === "reviewed-selected-eop-melody-only") {
    return "已核对所选第16–35小节，76个单音、40拍保持不变，无需改升降音；仅主旋律通过本次谱面复核，伴奏与实体听奏待核。";
  }
  if (baseSongId === "see-you-again" && scopeReview?.status === "reviewed-selected-guitarworld-preview") {
    return "已核对所选12小节公开预览，86个单音、48拍、80 BPM；止于预览边界，不是全曲。高音快段建议慢速分段；可选轻伴奏只取同谱低声部，实体仍弹单音。";
  }
  if (baseSongId === "tai-yang-zhao-chang-sheng-qi" && scopeReview?.status === "reviewed-selected-eop-melody") {
    return "已核对所选17小节编配，四处延音不再重拨；56个单音、68拍，保留原谱112 BPM。仅练主旋律，旧伴奏暂不使用。";
  }
  if (baseSongId === "tong-nian" && scopeReview?.status === "reviewed-selected-teaching-vocal-strophe") {
    return "选用人音教材完整16小节单遍人声，79次起音、64拍；G调整体移至C调，保留七处延音连接、独立重拨及三处人声休止。省略吉他伴奏，不按五排歌词扩成五遍；105 BPM为练习设定。";
  }
  if (baseSongId === "sheng-sheng-man" && scopeReview?.status === "reviewed-selected-xiqiang-principal-edition") {
    return "选用逸兔戏腔简谱24个实写小节，按首尾反复走两遍：252次主旋律起音、192拍；E调整体移至C调E4–G5，保留原谱72 BPM。明确省略每遍14个无定时倚音与4处波音，不挪主旋律；仅单音，无伴奏。";
  }
  if (baseSongId === "tong-nian" && scopeReview?.status === "reviewed-opening-common-ties") {
    return "仅修正开头两处同音延音线，少拨两次；第3–4小节有版本差异，其余段落仍待核。105 BPM 保留为练习速度，旧伴奏暂不使用。";
  }
  if (baseSongId === "katyusha" && scopeReview?.status === "unresolved-melody-source-mapping") {
    return "待核版：现有73音与所列来源的旋律、节奏对应尚未厘清，不能只改拍号视为校准；保留旧值，不作为已核准旋律。";
  }
  if (baseSongId === "bie-kan-wo-zhi-shi-yi-zhi-yang" && scopeReview?.status === "reviewed-selected-verse-excerpt") {
    return "已核对所选主歌68音，止于63拍末音结束；不含后续休止与副歌弱起，副歌含升音。120 BPM 为练习设定。";
  }
  if (baseSongId === "xuan-cao-hua" && scopeReview?.status === "reviewed-selected-complete-vocal-edition") {
    return "选用山山吉他谱的完整人声路线，183个单音、64个3/4小节，保留重复拨音与20处人声休止；省略吉他前奏与原谱吉他拨法。84 BPM为练习设定，可慢速分段。";
  }
  if (baseSongId === "ju-ci-lang-de-xia-tian" && scopeReview?.status === "reviewed-selected-piano-first-theme") {
    return "选用EOP C调钢琴版首主题上声部，61个单音、16个2/4小节，原谱96 BPM；同音延音不重拨，保留休止。含十六分音，建议先0.35–0.40倍慢练；不含前奏与后续重复段。";
  }
  if (baseSongId === "ping-fan-zhi-lu" && scopeReview?.status === "reviewed-selected-short-vocal-edition") {
    return "选用破晓/弹琴吧短编配的主歌与副歌，93个单音、17小节68拍，原谱80 BPM；保留开头、句间与末尾人声休止。十六分音和高音建议先慢练，吉他伴奏省略。";
  }
  if (baseSongId === "da-yu" && scopeReview?.status === "reviewed-selected-numbered-melody-excerpt") {
    return "选用简和谱前奏至首段副歌，162个单音、32小节；保留谱面八度与延音，80 BPM为练习设定。仅练旋律，不含后续反复与尾奏。";
  }
  if (baseSongId === "da-yu-xiao-yu" && scopeReview?.status === "reviewed-vocal-melody-interlude-omitted") {
    return "已按所选谱核对11小节单音旋律；第9–10小节恢复八分音节奏，省略另列的括号间奏。";
  }
  if (baseSongId === "mi-xue-bing-cheng-theme" && scopeReview?.status === "reviewed-melody-with-intro-chord-omission") {
    return "已按所选谱核对单音主题；前奏第5小节保留一拍单音，省略随后琶音和弦。旧伴奏暂不使用。";
  }
  if (baseSongId === "qing-cheng-shan-xia-bai-su-zhen" && scopeReview?.status === "reviewed-selected-complete-vocal-edition") {
    return "选用罗林斯谱面鞠婧祎版完整30小节人声主音，196次起音、120拍；保留原C调G3–D5与82 BPM、真实重拨及写出的收尾。省略五个无定量倚音与器乐前后奏，仅练单音；十六分音建议分段慢练。";
  }
  if (baseSongId === "rang-wo-men-dang-qi-shuang-jiang" && scopeReview?.status === "reviewed-selected-complete-textbook-melody") {
    return "选用山东教育教材完整30小节主旋律，63个单音、60拍；降E调统一移至C调，保留延音、重拨与四处休止。省略第7小节无定量倚音，仅练单音；96 BPM为练习设定。";
  }
  if (baseSongId === "hong-yan" && scopeReview?.status === "reviewed-selected-school-fixed-beat-edition") {
    return "选用粤教花城教材完整24小节主旋律，98次起音、96个固定练习拍；D调整体移至C调，保留两遍主题与完整结束句、同音延音不重拨。省略8组无定量倚音，延长记号不另加拍；56 BPM为练习设定。";
  }
  if (baseSongId === "song-bie" && scopeReview?.status === "reviewed-selected-complete-teaching-edition") {
    return "选用《中国诗乐二十品》24小节教学版，86个单音，整体由降E调移至C调；保留六处两拍休止。70 BPM为练习设定，仅练主旋律。";
  }
  if (baseSongId === "song-bie" && scopeReview?.status === "reviewed-cadence-only-rest-needs-review") {
    return "第7–8小节按所选谱校正音区；第3–4小节八度及后半段仍待核，旧伴奏暂不使用。";
  }
  if (baseSongId === "qing-hua-ci" && scopeReview?.status === "reviewed-selected-piano-theme-excerpt") {
    return "选用EOP简易钢琴版第25–40小节上声部，83个单音、64拍，保留原谱96 BPM；是主题选段，八分音和跳进建议先慢速练习；可选根音轻伴奏。";
  }
  if (baseSongId === "jasmine" && scopeReview?.status === "reviewed-selected-short-arrangement") {
    return "选用黄秀泉14小节短版，67个单音、56拍，保留完整主题和末尾1拍休止；仅练主旋律。";
  }
  if (baseSongId === "interstellar-main-theme" && scopeReview?.status === "reviewed-tail-only-rest-needs-review") {
    return "第44–49小节已按所选谱恢复三连音，尾段密集，建议慢速分段；前段声部与音区仍待核，第42小节起为4/4。";
  }
  if (baseSongId === "yun-yan-cheng-yu" && scopeReview?.status === "reviewed-with-deferred-measure" &&
      Array.isArray(scopeReview.deferredBeatRanges) &&
      scopeReview.deferredBeatRanges.some((range) => Array.isArray(range) && range[0] === 108 && range[1] === 112)) {
    return "第28小节整节暂留旧版，音高与节奏待核；其余按所选谱校对，末尾保留4拍旋律休止。";
  }
  if (baseSongId === "yun-yan-cheng-yu" && /triplet.*grace.*quantized to 0\.25/i.test(limitations)) {
    return "谱面待复核：仍有三连音和短倚音组被简化为0.25拍，节奏尚待核对。";
  }
  return "";
}

// Only these reviewed informational disclosures start collapsed. Unresolved
// source/fit warnings remain open, including legacy notices and future additions.
export function shouldExpandSongReviewNotice(song) {
  if (!getSongReviewNotice(song)) return false;
  const informationalScopes = {
    "ling-er-xiang-ding-dang": "reviewed-selected-short-refrain",
    "zhu-zhu-xia-theme": "reviewed-selected-eop-melody-only",
    "see-you-again": "reviewed-selected-guitarworld-preview",
    "jasmine": "reviewed-selected-short-arrangement",
    "qing-hua-ci": "reviewed-selected-piano-theme-excerpt",
    "tai-yang-zhao-chang-sheng-qi": "reviewed-selected-eop-melody",
    "mi-xue-bing-cheng-theme": "reviewed-melody-with-intro-chord-omission",
    "tong-nian": "reviewed-selected-teaching-vocal-strophe",
    "sheng-sheng-man": "reviewed-selected-xiqiang-principal-edition",
    "hong-yan": "reviewed-selected-school-fixed-beat-edition",
    "song-bie": "reviewed-selected-complete-teaching-edition",
    "qing-cheng-shan-xia-bai-su-zhen": "reviewed-selected-complete-vocal-edition",
    "rang-wo-men-dang-qi-shuang-jiang": "reviewed-selected-complete-textbook-melody",
    "xuan-cao-hua": "reviewed-selected-complete-vocal-edition",
    "ju-ci-lang-de-xia-tian": "reviewed-selected-piano-first-theme",
    "ping-fan-zhi-lu": "reviewed-selected-short-vocal-edition",
    "da-yu": "reviewed-selected-numbered-melody-excerpt",
    "da-yu-xiao-yu": "reviewed-vocal-melody-interlude-omitted",
    "bie-kan-wo-zhi-shi-yi-zhi-yang": "reviewed-selected-verse-excerpt"
  };
  const expected = informationalScopes[getSongBaseId(song)];
  return !expected || song.sourceFeatures?.sourceReview?.currentScopeReview?.status !== expected;
}

export function getEventTotalBeats(events) {
  return events.reduce((end, event) => Math.max(end, event.beat + event.duration), 0);
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeDifficulty(value) {
  const text = String(value || "").trim().toLowerCase();
  return DIFFICULTY_ALIASES.get(text) || null;
}

function normalizeTitle(title) {
  const value = String(title || "").trim();
  return value || "本地导入歌曲";
}

function slugify(value) {
  const ascii = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return ascii || `song_${Date.now().toString(36)}`;
}

function makeLocalSongId(rawId, title, existingLibrary) {
  const base = slugify(rawId || title);
  let id = base.startsWith("local_") ? base : `local_${base}`;
  let index = 2;

  while (existingLibrary[id]) {
    id = `${base.startsWith("local_") ? base : `local_${base}`}_${index}`;
    index += 1;
  }

  return id;
}

function isRestDegree(degree) {
  const value = String(degree ?? "").trim().toLowerCase();
  return value === "0" || value === "rest" || value === "-";
}

function getNoteNameFromNotation(item) {
  const degree = String(item.degree || "").trim();
  if (!DEGREE_TO_NOTE[degree]) {
    throw new Error(`发现不支持的简谱音级: ${degree}`);
  }

  const octave = Number.isInteger(item.octave) ? item.octave : Number(item.octave || 0);
  if (!Number.isInteger(octave)) {
    throw new Error(`音级 ${degree} 的 octave 必须是整数`);
  }

  const noteName = `${DEGREE_TO_NOTE[degree]}${4 + octave}`;
  if (!NOTE_INDEX.has(noteName)) {
    throw new Error(`音符 ${noteName} 超出 21 音 C 调卡林巴范围`);
  }

  return noteName;
}

export function compileNotationToSteps(notation) {
  return notation
    .filter((item) => !isRestDegree(item.degree))
    .map((item) => [getNoteNameFromNotation(item), item.beat, item.duration])
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
}

function normalizeNoteName(value) {
  const noteName = String(value || "").trim();
  return NOTE_INDEX.has(noteName) ? noteName : null;
}

function normalizeEventNote(rawNote, fallbackJudge = false, fallbackRole = "melody") {
  const source = typeof rawNote === "string" ? { name: rawNote } : rawNote;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }

  const name = normalizeNoteName(source.name);
  if (!name) {
    return null;
  }

  const role = NOTE_ROLES.has(source.role) ? source.role : fallbackRole;
  const velocity = clamp(normalizeNumber(source.velocity, 1), 0.1, 1.2);
  return {
    name,
    role,
    judge: typeof source.judge === "boolean" ? source.judge : fallbackJudge,
    velocity
  };
}

function normalizeStepList(steps) {
  if (!Array.isArray(steps) || !steps.length) {
    return [];
  }

  return steps
    .map((step) => {
      if (!Array.isArray(step) || step.length !== 3) {
        return null;
      }

      const [name, beat, duration] = step;
      const noteName = normalizeNoteName(name);
      const beatNumber = Number(beat);
      const durationNumber = Number(duration);
      if (!noteName || !Number.isFinite(beatNumber) || beatNumber < 0 || !Number.isFinite(durationNumber) || durationNumber <= 0) {
        return null;
      }

      return [noteName, beatNumber, durationNumber];
    })
    .filter(Boolean)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
}

function normalizeEventsFromSteps(steps) {
  return normalizeStepList(steps).map(([name, beat, duration]) => ({
    beat,
    duration,
    notes: [
      {
        name,
        role: "melody",
        judge: true,
        velocity: 1
      }
    ]
  }));
}

function normalizeSongEvents(song) {
  if (Number(song.schemaVersion || 1) === 2) {
    if (!Array.isArray(song.events) || !song.events.length) {
      return [];
    }

    return song.events
      .map((event) => {
        if (!event || typeof event !== "object" || Array.isArray(event)) {
          return null;
        }

        const beat = Number(event.beat);
        const duration = Number(event.duration);
        if (!Number.isFinite(beat) || beat < 0 || !Number.isFinite(duration) || duration <= 0) {
          return null;
        }

        const notes = Array.isArray(event.notes)
          ? event.notes.map((note) => normalizeEventNote(note, false, event.notes.length > 1 ? "harmony" : "melody")).filter(Boolean)
          : [];
        if (!notes.length) {
          return null;
        }

        const normalized = {
          beat,
          duration,
          notes
        };

        if (Number.isFinite(Number(event.judgeWindow)) && Number(event.judgeWindow) > 0) {
          normalized.judgeWindow = clamp(Number(event.judgeWindow), 0.1, 2);
        }

        return normalized;
      })
      .filter(Boolean)
      .sort((a, b) => a.beat - b.beat || a.notes[0].name.localeCompare(b.notes[0].name));
  }

  return normalizeEventsFromSteps(song.steps);
}

function normalizeAutoAccompanimentNote(rawNote) {
  const source = typeof rawNote === "string" ? { name: rawNote } : rawNote;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }

  const name = normalizeNoteName(source.name);
  if (!name) {
    return null;
  }

  return {
    name,
    role: NOTE_ROLES.has(source.role) ? source.role : "harmony",
    velocity: clamp(normalizeNumber(source.velocity, 0.65), ACCOMPANIMENT_MIN_VELOCITY, ACCOMPANIMENT_MAX_VELOCITY)
  };
}

function normalizeAutoAccompaniment(rawAutoAccompaniment) {
  if (!rawAutoAccompaniment || typeof rawAutoAccompaniment !== "object" || Array.isArray(rawAutoAccompaniment)) {
    return null;
  }

  if (!Array.isArray(rawAutoAccompaniment.events) || !rawAutoAccompaniment.events.length) {
    return null;
  }

  const events = rawAutoAccompaniment.events
    .map((event) => {
      if (!event || typeof event !== "object" || Array.isArray(event)) {
        return null;
      }

      const beat = Number(event.beat);
      const duration = Number(event.duration);
      if (!Number.isFinite(beat) || beat < 0 || !Number.isFinite(duration) || duration <= 0) {
        return null;
      }

      const seenNotes = new Set();
      const notes = Array.isArray(event.notes)
        ? event.notes
            .map((note) => normalizeAutoAccompanimentNote(note))
            .filter((note) => {
              if (!note || seenNotes.has(note.name)) {
                return false;
              }
              seenNotes.add(note.name);
              return true;
            })
        : [];
      if (!notes.length) {
        return null;
      }

      const normalized = {
        beat,
        duration,
        notes
      };

      if (typeof event.pattern === "string" && event.pattern.trim()) {
        normalized.pattern = event.pattern.trim();
      }

      return normalized;
    })
    .filter(Boolean)
    .sort((a, b) => a.beat - b.beat || a.notes[0].name.localeCompare(b.notes[0].name));

  if (!events.length) {
    return null;
  }

  return {
    enabledByDefault: Boolean(rawAutoAccompaniment.enabledByDefault),
    volume: clamp(normalizeNumber(rawAutoAccompaniment.volume, 0.55), 0, 1),
    events
  };
}

function normalizeRhythm(rawRhythm) {
  if (!isPlainObject(rawRhythm)) {
    return null;
  }

  const restWindows = Array.isArray(rawRhythm.restWindows)
    ? rawRhythm.restWindows
        .map((window) => {
          if (!isPlainObject(window)) {
            return null;
          }

          const beat = Number(window.beat);
          const duration = Number(window.duration);
          if (!Number.isFinite(beat) || beat < 0 || !Number.isFinite(duration) || duration <= 0) {
            return null;
          }

          const policy = RHYTHM_REST_POLICIES.has(window.policy) ? window.policy : "silent";
          const normalized = { beat, duration, policy };
          if (typeof window.reason === "string" && window.reason.trim()) {
            normalized.reason = window.reason.trim();
          }
          return normalized;
        })
        .filter(Boolean)
        .sort((a, b) => a.beat - b.beat || a.duration - b.duration)
    : [];

  const sources = Array.isArray(rawRhythm.sources)
    ? rawRhythm.sources
        .map((source) => {
          if (!isPlainObject(source)) {
            return null;
          }
          const label = String(source.label || "").trim();
          const url = String(source.url || "").trim();
          if (!label && !url) {
            return null;
          }
          return { label: label || url, url };
        })
        .filter(Boolean)
    : [];

  const rhythm = {
    sourceStatus: RHYTHM_SOURCE_STATUSES.has(rawRhythm.sourceStatus) ? rawRhythm.sourceStatus : "inferred",
    pickupBeats: Math.max(0, normalizeNumber(rawRhythm.pickupBeats, 0)),
    restWindows
  };

  if (sources.length) {
    rhythm.sources = sources;
  }

  return rhythm;
}

function rangesOverlap(firstBeat, firstDuration, secondBeat, secondDuration) {
  return firstBeat < secondBeat + secondDuration && secondBeat < firstBeat + firstDuration;
}

function applyRhythmToAutoAccompaniment(autoAccompaniment, rhythm) {
  if (!autoAccompaniment || !rhythm?.restWindows?.length) {
    return autoAccompaniment;
  }

  const silentWindows = rhythm.restWindows.filter((window) => window.policy === "silent");
  if (!silentWindows.length) {
    return autoAccompaniment;
  }

  const events = autoAccompaniment.events.filter((event) =>
    silentWindows.every((window) => !rangesOverlap(event.beat, event.duration, window.beat, window.duration))
  );

  return events.length ? { ...autoAccompaniment, events } : null;
}

function getJudgeNotesForSong(song, event) {
  const judgeNotes = event.notes.filter((note) => note.judge);
  if (song.judgementMode === "chord") {
    return judgeNotes;
  }

  return judgeNotes.filter((note) => note.role === "melody").slice(0, 1);
}

function buildJudgeSteps(song, events) {
  return events
    .flatMap((event) => getJudgeNotesForSong(song, event).map((note) => [note.name, event.beat, event.duration]))
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
}

function countArrangementNotes(events) {
  return events.reduce((total, event) => total + event.notes.length, 0);
}

function getStepTotalBeats(steps) {
  return steps.reduce((end, [, beat, duration]) => Math.max(end, Number(beat) + Number(duration)), 0);
}

function getPhysicalJumpScore(steps) {
  return steps.reduce((maxJump, step, index) => {
    if (index === 0) {
      return maxJump;
    }

    const previousIndex = NOTE_INDEX.get(steps[index - 1][0]);
    const currentIndex = NOTE_INDEX.get(step[0]);
    return Math.max(maxJump, Math.abs(currentIndex - previousIndex));
  }, 0);
}

function getPhysicalSpan(steps) {
  const indexes = steps.map(([name]) => NOTE_INDEX.get(name));
  return Math.max(...indexes) - Math.min(...indexes);
}

export function estimateSongDifficulty(song) {
  const steps = Array.isArray(song.steps)
    ? song.steps.filter(([name, beat, duration]) =>
        NOTE_INDEX.has(name) &&
        Number.isFinite(Number(beat)) &&
        Number.isFinite(Number(duration)) &&
        Number(duration) > 0
      )
    : [];

  if (!steps.length) {
    return "easy";
  }

  const bpm = clamp(normalizeNumber(song.bpm, 96), 40, 220);
  const totalBeats = Math.max(1, getStepTotalBeats(steps));
  const noteDensity = steps.length / totalBeats;
  const minDuration = Math.min(...steps.map(([, , duration]) => Number(duration)));
  const maxJump = getPhysicalJumpScore(steps);
  const span = getPhysicalSpan(steps);

  let score = 0;
  if (bpm >= 136) {
    score += 2;
  } else if (bpm >= 112) {
    score += 1;
  }

  if (noteDensity >= 1.35) {
    score += 2;
  } else if (noteDensity >= 0.95) {
    score += 1;
  }

  if (minDuration <= 0.25) {
    score += 1;
  } else if (minDuration <= 0.5 && noteDensity >= 0.9) {
    score += 1;
  }

  if (maxJump >= 10) {
    score += 2;
  } else if (maxJump >= 6) {
    score += 1;
  }

  if (span >= 16) {
    score += 2;
  } else if (span >= 11) {
    score += 1;
  }

  if (steps.length >= 96) {
    score += 2;
  } else if (steps.length >= 48) {
    score += 1;
  }

  if (score >= 7) {
    return "hard";
  }
  if (score >= 4) {
    return "medium";
  }
  return "easy";
}

function normalizeNotation(rawNotation) {
  if (!Array.isArray(rawNotation) || rawNotation.length === 0) {
    throw new Error("notation 必须是非空数组");
  }

  if (rawNotation.length > 1200) {
    throw new Error("notation 过长，请让 AI 改用 schemaVersion 2 events");
  }

  return rawNotation.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`notation 第 ${index + 1} 项必须是对象`);
    }

    const degree = String(item.degree ?? "").trim();
    if (!isRestDegree(degree) && !DEGREE_TO_NOTE[degree]) {
      throw new Error(`notation 第 ${index + 1} 项 degree 必须是 1 到 7`);
    }

    const octave = Number(item.octave || 0);
    if (!Number.isInteger(octave) || octave < -1 || octave > 2) {
      throw new Error(`notation 第 ${index + 1} 项 octave 必须是 -1 到 2 的整数`);
    }

    if (!isFiniteNumber(item.beat) || Number(item.beat) < 0) {
      throw new Error(`notation 第 ${index + 1} 项 beat 必须是大于等于 0 的数字`);
    }

    if (!isFiniteNumber(item.duration) || Number(item.duration) <= 0) {
      throw new Error(`notation 第 ${index + 1} 项 duration 必须是大于 0 的数字`);
    }

    const normalized = {
      degree,
      octave,
      beat: Number(item.beat),
      duration: Number(item.duration)
    };

    if (!isRestDegree(degree)) {
      getNoteNameFromNotation(normalized);
    }

    return normalized;
  }).sort((a, b) => a.beat - b.beat);
}

function assertStepSong(song) {
  return normalizeStepList(song.steps).length > 0;
}

function normalizeStoredSong(song) {
  if (!isPlainObject(song) || typeof song.id !== "string" || !song.id.trim()) {
    return null;
  }

  const schemaVersion = Number(song.schemaVersion || 1);
  if (schemaVersion !== 1 && schemaVersion !== 2) {
    return null;
  }

  const arrangementKind = ARRANGEMENT_KINDS.has(song.arrangementKind)
    ? song.arrangementKind
    : schemaVersion === 2
      ? "chord"
      : "melody";
  const judgementMode = JUDGEMENT_MODES.has(song.judgementMode)
    ? song.judgementMode
    : arrangementKind === "chord"
      ? "chord"
      : "melody";

  const events = normalizeSongEvents({ ...song, schemaVersion, arrangementKind, judgementMode });
  if (!events.length) {
    return null;
  }

  const songForJudgement = { ...song, arrangementKind, judgementMode };
  const steps = schemaVersion === 1 ? normalizeStepList(song.steps) : buildJudgeSteps(songForJudgement, events);
  if (!steps.length && !assertStepSong({ steps: song.steps })) {
    return null;
  }

  const judgeNoteCount = steps.length;
  const arrangementNoteCount = countArrangementNotes(events);
  const rhythm = schemaVersion === 2 ? normalizeRhythm(song.rhythm) : null;
  const autoAccompaniment = schemaVersion === 2
    ? applyRhythmToAutoAccompaniment(normalizeAutoAccompaniment(song.autoAccompaniment), rhythm)
    : null;
  const practiceAccompaniment = schemaVersion === 2
    ? applyRhythmToAutoAccompaniment(normalizeAutoAccompaniment(song.practiceAccompaniment), rhythm)
    : null;
  const difficulty = normalizeDifficulty(song.difficulty) || estimateSongDifficulty({ ...song, steps });
  const baseSongId = String(getSongBaseId(song)).trim() || song.id;

  const normalizedSong = {
    ...song,
    schemaVersion,
    baseSongId,
    versionLabel: song.versionLabel || (arrangementKind === "chord" ? CHORD_VERSION_LABEL : MELODY_VERSION_LABEL),
    arrangementKind,
    judgementMode,
    events,
    steps,
    judgeNoteCount,
    arrangementNoteCount,
    difficulty,
    uploader: song.uploader || "local",
    source: song.source || "local"
  };

  if (autoAccompaniment) {
    normalizedSong.autoAccompaniment = autoAccompaniment;
  } else {
    delete normalizedSong.autoAccompaniment;
  }

  if (practiceAccompaniment) normalizedSong.practiceAccompaniment = practiceAccompaniment;
  else delete normalizedSong.practiceAccompaniment;

  if (rhythm) {
    normalizedSong.rhythm = rhythm;
  } else {
    delete normalizedSong.rhythm;
  }

  return normalizedSong;
}

// In-memory confirmation evidence only: no new stored IDs, generations or schema.
// Keep original JSON too, since normalization can hide changes to metadata/notes.
const customSongGroupSnapshots = new WeakMap();
const libraryCustomSongs = new WeakMap();

function getRawSongGroupId(song) {
  if (!isPlainObject(song) || typeof song.id !== "string" || !song.id.trim()) return null;
  try {
    return String(getSongBaseId(song)).trim() || song.id;
  } catch {
    return null;
  }
}

function serializeSongGroup(rawSongs) {
  // Object key order and top-level record order are not song content. Preserve
  // array order inside each record and duplicate records; compare exact strings
  // rather than a lossy hash, including unknown fields and unreadable versions.
  const serialize = (song) => JSON.stringify(song, (key, value) =>
    isPlainObject(value) ? Object.fromEntries(Object.keys(value).sort().map((name) => [name, value[name]])) : value);
  return JSON.stringify(rawSongs.map(serialize).sort());
}

export function getCustomSongs(strict = false) {
  const rawSongs = getCustomSongArray(strict);
  const groups = new Map();
  for (const rawSong of rawSongs) {
    const baseSongId = getRawSongGroupId(rawSong);
    if (baseSongId === null) continue;
    if (!groups.has(baseSongId)) groups.set(baseSongId, []);
    groups.get(baseSongId).push(rawSong);
  }
  const snapshots = new Map([...groups].map(([baseSongId, songs]) =>
    [baseSongId, Object.freeze({ baseSongId, content: serializeSongGroup(songs) })]));
  return rawSongs.map((rawSong) => {
    const song = normalizeStoredSong(isPlainObject(rawSong) ? { ...rawSong, source: "local" } : rawSong);
    if (song) customSongGroupSnapshots.set(song, snapshots.get(song.baseSongId));
    return song;
  }).filter(Boolean);
}

// Only use records from the already-rendered local group. Never reread storage
// when opening its confirmation: an old title cannot authorize a new import.
export function getCustomSongGroupSnapshot(songs) {
  if (!Array.isArray(songs) || !songs.length) return null;
  const snapshot = customSongGroupSnapshots.get(songs[0]);
  return snapshot && songs.every((song) => customSongGroupSnapshots.get(song) === snapshot) ? snapshot : null;
}

export function getCustomSongsForLibrary(library) {
  return libraryCustomSongs.get(library)?.slice() || [];
}

export function getSongLibrary({ strict = false } = {}) {
  const library = Object.create(null);
  for (const [id, song] of Object.entries(SONG_LIBRARY)) {
    const normalized = normalizeStoredSong({ ...song, source: "system" });
    if (normalized) library[id] = normalized;
  }
  const localSongs = getCustomSongs(strict);
  libraryCustomSongs.set(library, localSongs);
  localSongs.forEach((song) => {
    library[song.id] = song;
  });
  // Legacy local storage can contain only the arrangement. Add a transient
  // practice view without rewriting or discarding that original saved record.
  const melodyBaseIds = new Set(getPracticeSongs(library).map(getSongBaseId));
  const fallbackSources = Object.values(library).sort((a, b) => getSongVersionRank(a) - getSongVersionRank(b));
  for (const song of fallbackSources) {
    const baseSongId = getSongBaseId(song);
    if (melodyBaseIds.has(baseSongId)) continue;
    // Missing roles on a multi-note legacy event are ambiguous. Keep the source
    // available in local management rather than inventing a melody from pitch.
    if (!canExtractMelody(song.events)) continue;
    let id = baseSongId;
    let suffix = 1;
    while (Object.hasOwn(library, id)) {
      id = `${baseSongId}-melody${suffix === 1 ? "" : `-${suffix}`}`;
      suffix += 1;
    }
    const melody = normalizeStoredSong({
      ...song,
      id,
      baseSongId,
      schemaVersion: 2,
      arrangementKind: "melody",
      judgementMode: "melody",
      versionLabel: MELODY_VERSION_LABEL,
      practiceTitle: `${song.title}主旋律练习轨道`,
      scoreTitle: `${song.title}主旋律简谱进度`,
      events: buildMelodyEvents(song.events)
    });
    if (melody) {
      library[id] = melody;
      melodyBaseIds.add(baseSongId);
    }
  }
  return library;
}

// Validate new uploads before tolerant legacy normalization can drop a note,
// guess a role, clamp timing, or remove a contradictory accompaniment event.
// This proves structural consistency only; source fidelity requires review.
const IMPORT_BEAT_EPSILON = 1e-9;

function assertImportNumber(value, path, min = 0, max = Infinity) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${path} 必须是 ${min} 以上${Number.isFinite(max) ? `、${max} 以下` : ""}的有限数字，不能留空或写成字符串`);
  }
}

function assertImportTiming(value, path) {
  assertImportNumber(value.beat, `${path}.beat`);
  assertImportNumber(value.duration, `${path}.duration`);
  if (value.duration <= 0 || !Number.isFinite(value.beat + value.duration)) {
    throw new Error(`${path} 的 duration 必须大于 0，且结束拍 beat + duration 必须是有限数字`);
  }
}

function assertImportNote(rawNote, path, accompaniment = false) {
  const note = typeof rawNote === "string" ? { name: rawNote } : rawNote;
  if (!isPlainObject(note)) throw new Error(`${path} 必须是音符对象或合法音名`);
  if (!normalizeNoteName(note.name)) {
    throw new Error(`${path} 的音符 ${String(note.name ?? "（缺失）")} 不在固定 21 音 C 调卡林巴范围；不能删除或替换升降音，请核对谱源及整体转调方案`);
  }
  if (Object.hasOwn(note, "role") && !NOTE_ROLES.has(note.role)) {
    throw new Error(`${path}.role 无效，请明确标注 melody、harmony、bass、arpeggio 或 ornament`);
  }
  if (Object.hasOwn(note, "judge") && (accompaniment || typeof note.judge !== "boolean")) {
    throw new Error(accompaniment ? `${path} 是自动伴奏，不能设置 judge` : `${path}.judge 必须是 true 或 false`);
  }
  if (Object.hasOwn(note, "velocity")) {
    assertImportNumber(note.velocity, `${path}.velocity`, accompaniment ? ACCOMPANIMENT_MIN_VELOCITY : 0.1, 1.2);
  }
  return note;
}

function assertImportEvents(events, path, accompaniment = false) {
  if (!Array.isArray(events) || !events.length) throw new Error(`${path} 必须是非空音符事件数组`);
  events.forEach((event, index) => {
    const location = `${path} 第 ${index + 1} 项`;
    if (!isPlainObject(event)) throw new Error(`${location} 必须是对象`);
    assertImportTiming(event, location);
    if (!Array.isArray(event.notes) || !event.notes.length) throw new Error(`${location}.notes 必须是非空数组`);
    const notes = event.notes.map((note, noteIndex) => assertImportNote(note, `${location} 第 ${noteIndex + 1} 个音`, accompaniment));
    if (!accompaniment) {
      if (notes.length > 1 && notes.filter((note) => note.role === "melody").length !== 1) {
        throw new Error(`${location} 必须明确标注一个主旋律音（role: "melody"），不能按最高音、排列顺序或 judge 标记猜测`);
      }
      if (notes.some((note) => note.role === "melody" && note.judge === false)) {
        throw new Error(`${location} 的主旋律必须可跟弹，请将 melody 音设置为 judge: true；独立伴奏请放入 autoAccompaniment`);
      }
      if (Object.hasOwn(event, "judgeWindow")) assertImportNumber(event.judgeWindow, `${location}.judgeWindow`, 0.1, 2);
    }
  });
}

function assertSupportedImportBacking(parsed) {
  // This playback layer is supported by built-in/stored V2 records only.
  // Reject its presence before import projection can silently discard music;
  // descriptive sourceFeatures.practiceAccompaniment remains valid metadata.
  if (isPlainObject(parsed) && Object.hasOwn(parsed, "practiceAccompaniment")) {
    throw new Error('顶层 practiceAccompaniment 是内置曲库专用播放字段，外部导入不支持。请核对谱源，按 schemaVersion: 2 的 autoAccompaniment 格式重新整理，完整保留伴奏音符、beat、duration、音量与默认开关、主旋律时间轴、rhythm.restWindows 的 silent/hold 策略和 sourceFeatures.sourceTotalBeats；不要仅删除字段而丢失伴奏。若已有 autoAccompaniment，须先核对两层内容并明确采用的编配，导入器不会自动合并、改名或选层。');
  }
}

function validateImportedScore(parsed) {
  assertSupportedImportBacking(parsed);
  if (Object.hasOwn(parsed, "schemaVersion") && ![1, 2].includes(parsed.schemaVersion)) {
    throw new Error("schemaVersion 只支持 1 或 2；新曲谱请使用 schemaVersion: 2");
  }
  for (const [field, min, max] of [["bpm", 40, 220], ["beatsPerMeasure", 2, 8], ["defaultSpeedFactor", 0.35, 1.4]]) {
    if (Object.hasOwn(parsed, field)) assertImportNumber(parsed[field], field, min, max);
  }
  if (Object.hasOwn(parsed, "beatsPerMeasure") && !Number.isInteger(parsed.beatsPerMeasure)) {
    throw new Error("beatsPerMeasure 必须是 2 到 8 的整数；请保留真实时值并说明变拍或拍号限制，不要随意取整");
  }
  if (Object.hasOwn(parsed, "tuning") && parsed.tuning !== "21-key-c") throw new Error('目前仅支持 tuning: "21-key-c"');
  for (const [field, values] of [["arrangementKind", ARRANGEMENT_KINDS], ["judgementMode", JUDGEMENT_MODES]]) {
    if (Object.hasOwn(parsed, field) && !values.has(parsed[field])) throw new Error(`${field} 只支持 melody 或 chord`);
  }

  let timeline = [];
  if (Number(parsed.schemaVersion || 2) === 2 && Object.hasOwn(parsed, "events")) {
    assertImportEvents(parsed.events, "events");
    timeline = parsed.events;
  } else if (Object.hasOwn(parsed, "notation")) {
    if (!Array.isArray(parsed.notation) || !parsed.notation.length) throw new Error("notation 必须是非空数组");
    parsed.notation.forEach((item, index) => {
      if (!isPlainObject(item)) throw new Error(`notation 第 ${index + 1} 项必须是对象`);
      assertImportTiming(item, `notation 第 ${index + 1} 项`);
    });
    normalizeNotation(parsed.notation);
    timeline = parsed.notation;
  } else if (Object.hasOwn(parsed, "steps")) {
    if (!Array.isArray(parsed.steps) || !parsed.steps.length) throw new Error("steps 必须是非空数组");
    timeline = parsed.steps.map((step, index) => {
      if (!Array.isArray(step) || step.length !== 3) throw new Error(`steps 第 ${index + 1} 项必须包含音名、起始拍和时值`);
      assertImportNote(step[0], `steps 第 ${index + 1} 项`);
      const event = { beat: step[1], duration: step[2] };
      assertImportTiming(event, `steps 第 ${index + 1} 项`);
      return event;
    });
  }

  const accompaniment = parsed.autoAccompaniment;
  if (Object.hasOwn(parsed, "autoAccompaniment")) {
    if (!isPlainObject(accompaniment)) throw new Error("autoAccompaniment 必须是对象；没有伴奏请省略该字段");
    assertImportEvents(accompaniment.events, "autoAccompaniment.events", true);
    if (Object.hasOwn(accompaniment, "enabledByDefault") && typeof accompaniment.enabledByDefault !== "boolean") {
      throw new Error("autoAccompaniment.enabledByDefault 必须是 true 或 false");
    }
    if (Object.hasOwn(accompaniment, "volume")) assertImportNumber(accompaniment.volume, "autoAccompaniment.volume", 0, 1);
  }

  const rhythm = parsed.rhythm;
  if (Object.hasOwn(parsed, "rhythm")) {
    if (!isPlainObject(rhythm)) throw new Error("rhythm 必须是对象");
    if (Object.hasOwn(rhythm, "sourceStatus") && !RHYTHM_SOURCE_STATUSES.has(rhythm.sourceStatus)) {
      throw new Error("rhythm.sourceStatus 只支持 verified、inferred 或 needs-review；校验通过不代表已经核对谱源");
    }
    if (Object.hasOwn(rhythm, "pickupBeats")) assertImportNumber(rhythm.pickupBeats, "rhythm.pickupBeats");
    if (Object.hasOwn(rhythm, "restWindows") && !Array.isArray(rhythm.restWindows)) throw new Error("rhythm.restWindows 必须是数组");
    (rhythm.restWindows || []).forEach((window, index) => {
      if (!isPlainObject(window)) throw new Error(`休止窗口第 ${index + 1} 项必须是对象`);
      assertImportTiming(window, `休止窗口第 ${index + 1} 项`);
      if (Object.hasOwn(window, "policy") && !RHYTHM_REST_POLICIES.has(window.policy)) throw new Error(`休止窗口第 ${index + 1} 项 policy 只支持 silent 或 hold`);
    });
  }

  if (Object.hasOwn(parsed, "sourceFeatures") && !isPlainObject(parsed.sourceFeatures)) throw new Error("sourceFeatures 必须是对象");
  const hasSourceEnd = Object.hasOwn(parsed.sourceFeatures || {}, "sourceTotalBeats");
  const sourceEnd = parsed.sourceFeatures?.sourceTotalBeats;
  if (hasSourceEnd) {
    assertImportNumber(sourceEnd, "sourceFeatures.sourceTotalBeats");
    const allWindows = [...timeline, ...(accompaniment?.events || []), ...(rhythm?.restWindows || [])];
    if (allWindows.some((event) => event.beat + event.duration > sourceEnd + IMPORT_BEAT_EPSILON) || (rhythm?.pickupBeats || 0) > sourceEnd + IMPORT_BEAT_EPSILON) {
      throw new Error("sourceFeatures.sourceTotalBeats 小于音符、伴奏、弱起或休止窗口的结束拍；请核对全段总拍数，不能截短谱尾");
    }
  }
  const noteEnd = getEventTotalBeats(timeline);
  if (!hasSourceEnd && (rhythm?.restWindows || []).some((window) => window.beat + window.duration > noteEnd + IMPORT_BEAT_EPSILON)) {
    throw new Error("末尾休止超出最后音符，请填写 sourceFeatures.sourceTotalBeats 保留完整结尾，不要拉长末音");
  }
}

function validateImportedLayers(events, autoAccompaniment, rhythm) {
  const overlap = (a, b) => Math.min(a.beat + a.duration, b.beat + b.duration) - Math.max(a.beat, b.beat) > IMPORT_BEAT_EPSILON;
  for (const [index, window] of (rhythm?.restWindows || []).entries()) {
    if (events.some((event) => overlap(event, window))) {
      throw new Error(`休止窗口第 ${index + 1} 项与主旋律重叠，请核对起音、时值或休止位置，不会自动删音或缩短时值`);
    }
    if (window.policy === "silent" && autoAccompaniment?.events.some((event) => overlap(event, window))) {
      throw new Error(`休止窗口第 ${index + 1} 项要求静音，却与自动伴奏重叠；请核对谱源并修正，不会自动删除伴奏`);
    }
  }
  for (const event of autoAccompaniment?.events || []) {
    if (events.some((melody) => Math.abs(melody.beat - event.beat) < IMPORT_BEAT_EPSILON &&
      event.notes.some((note) => note.name === melody.notes[0].name))) {
      throw new Error(`第 ${event.beat} 拍的自动伴奏与主旋律同拍同音重复起音，请先核对两层资料，不要重复混播`);
    }
  }
}

function normalizeImportedEvents(parsed) {
  const schemaVersion = Number(parsed.schemaVersion || 2);
  if (schemaVersion === 2 && Array.isArray(parsed.events)) {
    const events = normalizeSongEvents({ ...parsed, schemaVersion: 2 });
    if (events.length) {
      return events;
    }
  }

  if (Array.isArray(parsed.notation)) {
    const notation = normalizeNotation(parsed.notation);
    return normalizeEventsFromSteps(compileNotationToSteps(notation));
  }

  if (Array.isArray(parsed.steps)) {
    return normalizeEventsFromSteps(parsed.steps);
  }

  return [];
}

function dedupeEventNotes(events) {
  return events
    .map((event) => {
      const notesByName = new Map();
      for (const note of event.notes) {
        const previous = notesByName.get(note.name);
        if (!previous || (note.role === "melody" &&
          (previous.role !== "melody" || (note.judge && !previous.judge)))) {
          notesByName.set(note.name, note);
        }
      }
      return { ...event, notes: [...notesByName.values()] };
    })
    .filter((event) => event.notes.length);
}

function getMelodyNote(event) {
  return (
    event.notes.find((note) => note.role === "melody" && note.judge) ||
    event.notes.find((note) => note.role === "melody") ||
    event.notes.find((note) => note.judge) ||
    event.notes[0]
  );
}

function canExtractMelody(events) {
  if (new Set(events.map((event) => event.beat)).size !== events.length) return false;
  return events.every((event) => {
    const melodyNotes = event.notes.filter((note) => note.role === "melody");
    return melodyNotes.length === 1 || melodyNotes.filter((note) => note.judge).length === 1;
  });
}

function ensureImportedJudgement(events, judgementMode) {
  return dedupeEventNotes(events).map((event) => {
    if (event.notes.some((note) => note.judge)) {
      return event;
    }

    const melodyNote = getMelodyNote(event);
    const shouldJudgeChord = judgementMode === "chord" && event.notes.length > 1;
    return {
      ...event,
      notes: event.notes.map((note) => ({
        ...note,
        judge: shouldJudgeChord ? note.role !== "ornament" : note.name === melodyNote.name
      }))
    };
  });
}

function buildMelodyEvents(events) {
  return events.map((event) => {
    const melodyNote = getMelodyNote(event);
    const melodyEvent = {
      beat: event.beat,
      duration: event.duration,
      notes: [
        {
          ...melodyNote,
          role: "melody",
          judge: true,
          velocity: 1
        }
      ]
    };

    if (event.judgeWindow) {
      melodyEvent.judgeWindow = event.judgeWindow;
    }

    return melodyEvent;
  });
}

function hasChordTargets(parsed, events) {
  if (parsed.arrangementKind === "chord" || parsed.judgementMode === "chord") {
    return true;
  }

  return events.some((event) => {
    const judgeCount = event.notes.filter((note) => note.judge).length;
    const playableChordNotes = event.notes.filter((note) => note.role !== "ornament").length;
    return judgeCount > 1 || playableChordNotes > 1;
  });
}

function hasUploadedArrangement(parsed, events, autoAccompaniment) {
  return hasChordTargets(parsed, events) || Boolean(autoAccompaniment?.events?.length);
}

function getImportedBaseId(parsed) {
  const rawId = String(parsed.baseSongId || parsed.id || "").trim();
  if (rawId.endsWith("-chord") || rawId.endsWith("_chord")) {
    return rawId.slice(0, -6);
  }
  return rawId;
}

function buildImportedSongPair(parsed, existingLibrary) {
  if (!isPlainObject(parsed)) {
    throw new Error("导入内容必须是歌曲 JSON 对象");
  }

  const key = String(parsed.key || "C").trim().toUpperCase();
  if (key !== "C") {
    throw new Error('目前仅支持 key: "C"，请让 AI 先转成 C 调');
  }

  validateImportedScore(parsed);

  const title = normalizeTitle(parsed.title);
  const baseId = makeLocalSongId(getImportedBaseId(parsed), title, existingLibrary);
  const bpm = clamp(normalizeNumber(parsed.bpm, 96), 40, 220);
  const beatsPerMeasure = clamp(Math.round(normalizeNumber(parsed.beatsPerMeasure, 4)), 2, 8);
  const defaultSpeedFactor = clamp(normalizeNumber(parsed.defaultSpeedFactor, 0.9), 0.35, 1.4);
  const rawJudgementMode = JUDGEMENT_MODES.has(parsed.judgementMode) ? parsed.judgementMode : "melody";
  const importedEvents = normalizeImportedEvents(parsed);
  if (!importedEvents.length) {
    throw new Error("没有可导入的 events 音符；请让 AI 输出 schemaVersion 2 events");
  }
  if (new Set(importedEvents.map((event) => event.beat)).size !== importedEvents.length) {
    throw new Error("同一拍有多个主旋律事件，请先合并并明确一个单音主旋律，再导入练习");
  }
  if (!canExtractMelody(importedEvents)) {
    throw new Error('每个事件必须明确标注一个主旋律音（role: "melody"）；独立低音或和声请放入 autoAccompaniment，不会按最高音或排列顺序猜测');
  }
  const events = ensureImportedJudgement(importedEvents, rawJudgementMode);

  const melodyEvents = buildMelodyEvents(events);
  const melodySteps = buildJudgeSteps({ judgementMode: "melody" }, melodyEvents);
  if (!melodySteps.length) {
    throw new Error("没有可导入的主旋律音符");
  }

  const autoAccompaniment = normalizeAutoAccompaniment(parsed.autoAccompaniment);
  const rhythm = normalizeRhythm(parsed.rhythm);
  validateImportedLayers(melodyEvents, autoAccompaniment, rhythm);
  const filteredAutoAccompaniment = autoAccompaniment;
  const hasChordTargetNotes = hasChordTargets(parsed, events);
  const shouldCreateArrangementVersion = hasUploadedArrangement(parsed, events, filteredAutoAccompaniment);
  const difficulty = normalizeDifficulty(parsed.difficulty) || estimateSongDifficulty({ steps: melodySteps, bpm });
  const hint = String(parsed.hint || "本地导入曲谱").trim() || "本地导入曲谱";
  const common = {
    title,
    uploader: "local",
    source: "local",
    schemaVersion: 2,
    baseSongId: baseId,
    key: "C",
    tuning: "21-key-c",
    bpm,
    defaultSpeedFactor,
    beatsPerMeasure,
    difficulty,
    hint
  };

  if (isPlainObject(parsed.sourceFeatures)) {
    common.sourceFeatures = parsed.sourceFeatures;
  }

  const melodySong = normalizeStoredSong({
    ...common,
    id: baseId,
    versionLabel: MELODY_VERSION_LABEL,
    arrangementKind: "melody",
    judgementMode: "melody",
    practiceTitle: `${title}主旋律版练习轨道`,
    scoreTitle: `${title}主旋律版简谱进度`,
    events: melodyEvents,
    ...(!shouldCreateArrangementVersion && filteredAutoAccompaniment ? { autoAccompaniment: filteredAutoAccompaniment } : {}),
    ...(rhythm ? { rhythm } : {})
  });

  if (!melodySong) {
    throw new Error("主旋律版生成失败，请检查 events 的 beat、duration 和 notes");
  }

  if (!shouldCreateArrangementVersion) {
    return [melodySong];
  }

  const chordId = makeLocalSongId(`${baseId}_chord`, `${title} 和弦版`, { ...existingLibrary, [baseId]: melodySong });
  const arrangementVersionLabel = hasChordTargetNotes ? CHORD_VERSION_LABEL : "伴奏版";
  const arrangementJudgementMode = hasChordTargetNotes ? "chord" : "melody";
  const chordSong = normalizeStoredSong({
    ...common,
    id: chordId,
    versionLabel: arrangementVersionLabel,
    arrangementKind: "chord",
    judgementMode: arrangementJudgementMode,
    practiceTitle: `${title}${arrangementVersionLabel}练习轨道`,
    scoreTitle: `${title}${arrangementVersionLabel}简谱进度`,
    events,
    ...(filteredAutoAccompaniment ? { autoAccompaniment: filteredAutoAccompaniment } : {}),
    ...(rhythm ? { rhythm } : {})
  });

  if (!chordSong) {
    throw new Error("和弦版生成失败，请检查 events 里的和弦目标音");
  }

  return [melodySong, chordSong];
}

function assertUniqueImportJsonKeys(text) {
  // JSON.parse has already validated the grammar. Scan the original tokens,
  // since its resulting objects have lost every earlier duplicate member.
  // Keep an explicit stack so deeply nested metadata cannot exhaust recursion.
  const stack = [];
  const displayKey = key => {
    const characters = Array.from(key);
    const bounded = characters.slice(0, 32).join("") + (characters.length > 32 ? "…" : "");
    return JSON.stringify(bounded).replace(/[\u007f-\u009f\u061c\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/gu,
      character => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
  };
  const location = offset => {
    const lines = text.slice(0, offset).split(/\r\n|[\r\n]/);
    return `第 ${lines.length} 行第 ${Array.from(lines.at(-1)).length + 1} 列`;
  };
  const fail = (key, first, repeated) => {
    const segments = stack.slice(1).map(frame => frame.segment).concat(key);
    const visible = segments.length > 8 ? [...segments.slice(0, 4), null, ...segments.slice(-4)] : segments;
    const fullPath = "$" + visible.map(segment => segment === null ? "[…]"
      : typeof segment === "number" ? `[${segment}]`
        : /^[A-Za-z_$][\w$]*$/.test(segment) && segment.length <= 32 ? `.${segment}` : `[${displayKey(segment)}]`).join("");
    const pathCharacters = Array.from(fullPath);
    const path = pathCharacters.length > 360
      ? `${pathCharacters.slice(0, 160).join("")}…${pathCharacters.slice(-160).join("")}` : fullPath;
    const songIndex = stack[0]?.type === "array" ? stack[1]?.segment
      : stack[1]?.type === "array" && stack[1].segment === "songs" ? stack[2]?.segment : undefined;
    const prefix = Number.isInteger(songIndex) ? `第 ${songIndex + 1} 首歌曲：` : "";
    throw new Error(`${prefix}JSON 同一对象中字段 ${displayKey(key)} 重复（位置 ${path}；首次${location(first)}，重复${location(repeated)}）。请保留完整原稿，对照两处内容与谱源整理为唯一字段；不要直接删掉其中一份而丢失旋律或伴奏。`);
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const parent = stack.at(-1);
    if (character === "{" || character === "[") {
      const segment = parent?.type === "array" ? parent.index : parent?.key;
      stack.push(character === "{" ? { type: "object", segment, keys: new Map(), expectingKey: true }
        : { type: "array", segment, index: 0 });
    } else if (character === "}" || character === "]") {
      stack.pop();
    } else if (character === ",") {
      if (parent.type === "array") parent.index += 1;
      else parent.expectingKey = true;
    } else if (character === '"') {
      const start = index;
      index += 1;
      while (text[index] !== '"') {
        if (text[index] === "\\") index += 1;
        index += 1;
      }
      if (parent?.type === "object" && parent.expectingKey) {
        const key = JSON.parse(text.slice(start, index + 1));
        if (parent.keys.has(key)) fail(key, parent.keys.get(key), start);
        parent.keys.set(key, start);
        parent.key = key;
        parent.expectingKey = false;
      }
    }
  }
}

export function parseImportedSongs(rawText, existingLibrary = getSongLibrary()) {
  let parsed;
  let jsonText;
  try {
    jsonText = String(rawText);
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error("粘贴内容不是合法 JSON");
  }
  assertUniqueImportJsonKeys(jsonText);

  // Check the batch wrapper as well as each song before unwrapping it.
  assertSupportedImportBacking(parsed);
  const rawSongs = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.songs)
      ? parsed.songs
      : [parsed];

  if (!rawSongs.length) {
    throw new Error("导入内容没有歌曲 JSON");
  }

  const reservedLibrary = { ...existingLibrary };
  const songs = rawSongs.flatMap((song, index) => {
    let importedSongs;
    try {
      importedSongs = buildImportedSongPair(song, reservedLibrary);
    } catch (error) {
      if (rawSongs.length === 1) throw error;
      // Context is display-only: keep the original validation reason and never
      // coerce malformed titles or let long/control-filled names bury it.
      const title = typeof song?.title === "string"
        ? song.title.replace(/[\s\u0000-\u001f\u007f-\u009f\u061c\u200b\u200e\u200f\u202a-\u202e\u2060-\u206f]+/gu, " ").trim()
        : "";
      const characters = Array.from(title.slice(0, 82));
      const label = characters.slice(0, 40).join("") + (characters.length > 40 ? "…" : "");
      throw new Error(`第 ${index + 1} 首歌曲${label ? `「${label}」` : ""}：${error.message}`, { cause: error });
    }
    importedSongs.forEach((importedSong) => {
      reservedLibrary[importedSong.id] = importedSong;
    });
    return importedSongs;
  });

  if (!songs.length) {
    throw new Error("没有可导入的歌曲");
  }

  return songs;
}

export function parseImportedSong(rawText, existingLibrary = getSongLibrary()) {
  return parseImportedSongs(rawText, existingLibrary)[0];
}

export function saveCustomSong(song) {
  return saveCustomSongs([song])[0] || null;
}

// UI writes must share this lock, including deletion. Fail closed when unavailable:
// localStorage read/modify/write is not a cross-tab transaction on its own.
export async function withCustomSongWriteLock(write) {
  let entered = false;
  try {
    if (typeof navigator === "undefined" || typeof navigator.locks?.request !== "function") {
      throw new Error("当前页面无法安全保存本地曲库，原有数据未修改。请检查是否在 HTTPS 或 localhost 页面，并确认浏览器支持 Web Locks。");
    }
    return await navigator.locks.request("kalimba-custom-songs-write", { mode: "exclusive", ifAvailable: true }, (lock) => {
      if (!lock) throw new Error("另一个页面正在修改本地曲库，本次未保存。请稍后重试，输入内容已保留。");
      entered = true;
      return write();
    });
  } catch (error) {
    if (entered) throw error;
    throw new Error(`无法取得本地曲库保存权限：${error.message || "请稍后重试"}`, { cause: error });
  }
}

function reserveStoredSongIds(reserved, song) {
  if (!isPlainObject(song)) return;
  if (typeof song.id === "string" && song.id) reserved.add(song.id);
  if (typeof song.baseSongId === "string" && song.baseSongId) reserved.add(song.baseSongId);
  // Legacy reads trim/stringify the effective base even though raw IDs and
  // metadata stay untouched. Reserve that visible identity too, including for
  // records the current version cannot otherwise read.
  try {
    const base = getSongBaseId(song);
    if (base != null && String(base).trim()) reserved.add(String(base).trim());
  } catch {
    // Malformed identity metadata cannot erase the literal IDs reserved above.
  }
}

function unusedSongId(preferred, reserved) {
  let id = preferred;
  for (let index = 2; reserved.has(id); index += 1) id = `${preferred}_${index}`;
  return id;
}

// Reserved local display metadata. Import projection never reads this field;
// neither a JSON upload nor a caller replaying a saved record supplies its value.
const LOCAL_IMPORT_COPY_NUMBER = "localImportCopyNumber";

function getLocalSongCopyNumber(song) {
  const number = song?.[LOCAL_IMPORT_COPY_NUMBER];
  return song?.source === "local" && Number.isSafeInteger(number) && number >= 2 ? number : null;
}

export function getLocalSongCopyLabel(song) {
  const number = getLocalSongCopyNumber(song);
  return number === null ? "" : `副本 ${number}`;
}

export function getDuplicateImportNotice(savedSongs) {
  const duplicateGroups = new Set(savedSongs.filter((song) => getLocalSongCopyNumber(song) !== null).map(getSongBaseId));
  return duplicateGroups.size
    ? `检测到 ${duplicateGroups.size} 首重复乐谱，已另存为副本；原有歌曲未覆盖。`
    : "";
}

function getImportGroupSignature(group) {
  // Compare complete canonical records, not just melody/title/IDs. In particular,
  // do not normalize old raw data here: that could discard an unknown field or
  // malformed note and incorrectly declare two different scores identical.
  if (group.some((song) => !isPlainObject(song) || typeof song.id !== "string" || !song.id.trim())) return null;
  return serializeSongGroup(group.map((song) => {
    const content = { ...song };
    delete content.id;
    delete content.baseSongId;
    delete content[LOCAL_IMPORT_COPY_NUMBER];
    return content;
  }));
}

function addImportGroupToCopyIndex(index, group) {
  const signature = getImportGroupSignature(group);
  if (signature === null) return;
  const previous = index.get(signature) || { count: 0, number: 0 };
  index.set(signature, {
    count: previous.count + 1,
    number: group.reduce((number, song) => Math.max(number, getLocalSongCopyNumber(song) || 1), previous.number)
  });
}

// Synchronous internal commit helper: callers coordinating tabs must hold the
// write lock above. Never use import as an implicit replacement/update API.
export function saveCustomSongs(importedSongs) {
  if (!Array.isArray(importedSongs) || !importedSongs.length) throw new Error("没有可保存的歌曲");
  const normalizedSongs = importedSongs.map((song) => {
    const normalized = normalizeStoredSong(song);
    if (normalized) delete normalized[LOCAL_IMPORT_COPY_NUMBER];
    return normalized;
  });
  if (normalizedSongs.some((song) => !song) || new Set(normalizedSongs.map((song) => song.id)).size !== normalizedSongs.length) {
    throw new Error("导入歌曲数据不完整或编号重复，本次未保存任何歌曲。");
  }
  // Take the latest strict snapshot at the commit boundary. Keep every original
  // raw record, including metadata and versions this app cannot currently read.
  const songs = getCustomSongArray(true);
  const reserved = new Set();
  [...Object.values(SONG_LIBRARY), ...songs].forEach((song) => reserveStoredSongIds(reserved, song));
  const existingGroups = new Map();
  for (const song of songs) {
    const base = getRawSongGroupId(song) || (typeof song?.baseSongId === "string" ? song.baseSongId.trim() : null);
    if (!base) continue;
    if (!existingGroups.has(base)) existingGroups.set(base, []);
    existingGroups.get(base).push(song);
  }
  const copyIndex = new Map();
  for (const group of existingGroups.values()) addImportGroupToCopyIndex(copyIndex, group);
  const groups = new Map();
  normalizedSongs.forEach((song) => {
    if (!groups.has(song.baseSongId)) groups.set(song.baseSongId, []);
    groups.get(song.baseSongId).push(song);
  });
  const savedByOriginalId = new Map();
  for (const [originalBase, group] of groups) {
    const previousCopy = copyIndex.get(getImportGroupSignature(group));
    // Surviving numbers never change when an earlier copy is removed. Existing
    // unmarked legacy duplicates count too, without rewriting any old record.
    const nextCopy = previousCopy ? Math.max(previousCopy.count, previousCopy.number) + 1 : null;
    const copyNumber = Number.isSafeInteger(nextCopy) ? nextCopy : previousCopy ? previousCopy.count + 1 : null;
    const collides = reserved.has(originalBase) || group.some((song) => reserved.has(song.id));
    if (collides) reserved.add(originalBase);
    const baseSongId = unusedSongId(originalBase, reserved);
    reserved.add(baseSongId);
    for (const [index, song] of group.entries()) {
      let id = song.id;
      if (song.id === originalBase) {
        id = baseSongId;
      } else {
        if (baseSongId !== originalBase) {
          const suffix = song.id.startsWith(`${originalBase}_`) || song.id.startsWith(`${originalBase}-`)
            ? song.id.slice(originalBase.length) : `_version_${index + 1}`;
          id = `${baseSongId}${suffix}`;
        }
        id = unusedSongId(id, reserved);
      }
      reserved.add(id);
      savedByOriginalId.set(song.id, { ...song, id, baseSongId, ...(copyNumber ? { [LOCAL_IMPORT_COPY_NUMBER]: copyNumber } : {}) });
    }
    addImportGroupToCopyIndex(copyIndex, group.map((song) => savedByOriginalId.get(song.id)));
  }
  const savedSongs = normalizedSongs.map((song) => savedByOriginalId.get(song.id));
  saveCustomSongArray([...songs, ...savedSongs]);
  return savedSongs;
}

// Select exact readable records from one strict snapshot. An unreadable record
// sharing an old ID must not be collateral damage when deleting the visible song.
function deleteMatchingCustomSongs(matches, checkSnapshot = null) {
  const rawSongs = getCustomSongArray(true);
  const deletedSongs = [];
  const keptSongs = rawSongs.filter((rawSong) => {
    const song = normalizeStoredSong(isPlainObject(rawSong) ? { ...rawSong, source: "local" } : rawSong);
    if (!song || !matches(song)) return true;
    deletedSongs.push(song);
    return false;
  });
  if (checkSnapshot) checkSnapshot(rawSongs, deletedSongs);
  if (deletedSongs.length) saveCustomSongArray(keptSongs);
  return deletedSongs;
}

// As with saveCustomSongs, UI callers must hold withCustomSongWriteLock.
export function deleteCustomSong(songId) {
  const id = String(songId || "").trim();
  if (!id) return null;
  return deleteMatchingCustomSongs((song) => song.id === id)[0] || null;
}

export function deleteCustomSongGroup(baseSongId, expectedSnapshot) {
  const id = String(baseSongId || "").trim();
  if (!id) return null;
  // Legacy synchronous callers may omit evidence. The UI always supplies it
  // while holding the shared write lock, and a missing/invalid snapshot fails
  // closed. Check and delete from the same strict read with no await in between.
  const checkSnapshot = arguments.length > 1 ? (rawSongs, deletedSongs) => {
    const currentGroup = rawSongs.filter((song) => getRawSongGroupId(song) === id);
    if (!deletedSongs.length || expectedSnapshot?.baseSongId !== id ||
        expectedSnapshot.content !== serializeSongGroup(currentGroup)) {
      const error = new Error("本地歌曲已变化或不存在，本次未删除。请重新检查列表后再确认删除。");
      error.code = "STALE_CUSTOM_SONG_GROUP";
      throw error;
    }
  } : null;
  const deletedSongs = deleteMatchingCustomSongs((song) => song.baseSongId === id, checkSnapshot);
  if (!deletedSongs.length) return null;
  return {
    title: deletedSongs[0].title,
    ids: [...new Set(deletedSongs.map((song) => song.id))]
  };
}
