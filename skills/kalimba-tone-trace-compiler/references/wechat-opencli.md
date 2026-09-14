# 从拇指琴圈获取曲谱：OpenCLI

用户指定的优先目录：[拇指琴曲谱·总目录](https://mp.weixin.qq.com/s/B18DMAtTA7ah7w_lMfa7kg)。先从这里查曲名、别名、琴键数和单曲文章，再找独立参照或更合适的改编。目录中的键数标签不代表默认 C 调可直接演奏。

## 连接与读取

优先使用本机已有 OpenCLI 和日常 Chrome 中的 Browser Bridge 扩展。已验证的组合为 OpenCLI 1.8.7、扩展 1.0.24；本机命令入口为 `D:\Dev\AI\Tools\installs\opencli\opencli.ps1`，已加入 PATH。这是本机位置记录，其他机器先用 `Get-Command opencli` 查找。

```powershell
opencli doctor
opencli browser kalimba-sources tab new 'https://mp.weixin.qq.com/s/B18DMAtTA7ah7w_lMfa7kg'
```

`doctor` 应同时显示 daemon 和 extension connected。这里使用浏览器扩展，不依赖 Chrome 远程调试端口；无需为此重启用户 Chrome、复制用户配置或改用全新的隔离浏览器。不要把 daemon 启动成功当作扩展连接成功。

`tab new` 返回实际 page ID。用该 ID 提取文章标题或目录中匹配的链接，避免输出整个 HTML、无关标签页、视频签名参数或会话令牌。例如只查询目标曲名：

```powershell
opencli browser kalimba-sources eval --tab '<实际page-id>' 'JSON.stringify(Array.from(document.querySelectorAll("#js_content a")).filter(a => a.innerText.includes("目标曲名")).map(a => ({title:a.innerText,url:a.href})))'
```

以目录真实返回的单曲 URL 下载，不猜测 biz/mid/idx/sn。将 `<项目绝对路径>`、`<song-id>` 和 URL 替换为当前任务值：

```powershell
opencli weixin download --url '<单曲URL>' --output '<项目绝对路径>\private\sheets\raw\<song-id>\wechat' -f json
```

该命令默认保存正文 Markdown 和图片。逐项检查结果中的 `status` 与 `saved`，再确认实际文件存在、谱页齐全；即使命令退出码为 0，结果仍可能是 `failed — verification required`。连接正常也不保证每篇文章可读。

如遇验证，可以在已连接浏览器中正常打开该单曲文章，查看是否需要用户操作；验证未完成时不循环重试、不自动处理验证码，也不将验证页记作成功谱源。继续做其他可独立完成的核查。

## 谱面核对与记录

- 在本地查看图片，确认页数、末小节和终止线、反复记号、节拍、速度、调号及特殊调音说明。短改编和整首原曲分开标注；用户接受哪种范围就按哪种范围，不补猜。
- 对 17/21/30 音版本，读取实际音高与半音后评估 F3–E6 自然音集合。先检查整体移调是否成立；不可删除升降号、随意折叠八度，或以琴键数量代替适配判断。
- 将曲目身份、来源 URL、下载结果、谱页与范围、调音、待核对项写入 `private/sheets/review/<song-id>.json`。真实试听、源谱对照和数据校验分别记录。
- 原始正文和图片仅保存在 `private/sheets/`，不加入公开提交。读取时只输出任务需要的文字和元数据，视频 URL 可能带临时签名。
- 公开可读、用户授权推送 GitHub、以及素材复制发布许可不是同一件事；检查已知信息，不重复询问已有的操作授权。

命令发生变化时，优先检查本机 `opencli ... --help` 和[官方微信适配器文档](https://github.com/jackwener/opencli/blob/main/docs/adapters/browser/weixin.md)、[Browser Bridge 文档](https://github.com/jackwener/opencli/blob/main/docs/guide/browser-bridge.md)。
