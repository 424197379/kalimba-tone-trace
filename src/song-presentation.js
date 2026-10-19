// Presentation-only names for known built-in editions. Keep the full source
// title on the song and in repository evidence; a shorter name makes no fidelity claim.
// Exact matches are deliberate: never strip arbitrary parentheses, version
// words, or legitimate parts of imported/future song titles with a regexp.
const BUILTIN_DISPLAY_TITLES = new Map([
  ["fan-fang-xiang-de-zhong", ["《反方向的钟》（副歌选段）", "《反方向的钟》"]],
  ["jasmine", ["《茉莉花》（短版）", "《茉莉花》"]],
  ["bluebird", ["《青鸟》（待核简化版）", "《青鸟》"]],
  ["katyusha", ["《喀秋莎》（待核版）", "《喀秋莎》"]],
  ["bie-kan-wo-zhi-shi-yi-zhi-yang", ["《别看我只是一只羊》（主歌选段）", "《别看我只是一只羊》"]],
  ["da-yu", ["《大鱼》（前奏至副歌选段）", "《大鱼》"]],
  ["hong-yan", ["《鸿雁》（教材定拍版）", "《鸿雁》"]],
  ["ju-ci-lang-de-xia-tian", ["《菊次郎的夏天》（首主题）", "《菊次郎的夏天》"]],
  ["ling-er-xiang-ding-dang", ["《铃儿响叮当》（短版副歌主题）", "《铃儿响叮当》"]],
  ["ling-er-xiang-ding-dang-reviewed-support", ["《铃儿响叮当》（短版副歌主题）", "《铃儿响叮当》"]],
  ["mo-he-wu-ting-verse", ["《漠河舞厅》（主歌选段）", "《漠河舞厅》"]],
  ["ping-fan-zhi-lu", ["《平凡之路》（主歌＋副歌短版）", "《平凡之路》"]],
  ["qing-cheng-shan-xia-bai-su-zhen", ["《青城山下白素贞》（鞠婧祎版人声）", "《青城山下白素贞》"]],
  ["qing-hua-ci", ["《青花瓷》（主题短版）", "《青花瓷》"]],
  ["qing-hua-ci-reviewed-support", ["《青花瓷》（主题短版）", "《青花瓷》"]],
  ["rang-wo-men-dang-qi-shuang-jiang", ["《让我们荡起双桨》（教材版）", "《让我们荡起双桨》"]],
  ["see-you-again", ["《See You Again》12小节预览", "《See You Again》"]],
  ["see-you-again-reviewed-support", ["《See You Again》12小节预览", "《See You Again》"]],
  ["sheng-sheng-man", ["《声声慢》（戏腔简谱版）", "《声声慢》"]],
  ["song-bie", ["《送别》（教学版）", "《送别》"]],
  ["tian-kong-zhi-cheng", ["《天空之城》（改音版）", "《天空之城》"]],
  ["tong-nian", ["《童年》（教材人声版）", "《童年》"]],
  ["xuan-cao-hua", ["《萱草花》（声乐版）", "《萱草花》"]],
  ["xuan-cao-hua-reviewed-support", ["《萱草花》（声乐版）", "《萱草花》"]]
]);

export function getSongDisplayTitle(song) {
  const title = typeof song?.title === "string" ? song.title : "";
  if (song?.source !== "system") return title;
  const known = BUILTIN_DISPLAY_TITLES.get(song.id);
  return known && title === known[0] ? known[1] : title;
}
