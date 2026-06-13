# 卡林巴循音

Kalimba ToneTrace 是一个面向 21 音 C 调卡林巴的本地优先练习 App。它用下落音符块和横向简谱进度提示弹奏时机，支持示范播放、自动伴奏、本地曲谱导入和可选麦克风跟练。

在线使用：

[https://424197379.github.io/kalimba-tone-trace/](https://424197379.github.io/kalimba-tone-trace/)

## 主要功能

- 21 音 C 调卡林巴练习界面
- 下落块、横向简谱进度和琴键高亮
- 内置曲库搜索、难度筛选和版本切换
- 主旋律版、和弦版、伴奏版曲谱数据
- 示范播放和可开关自动伴奏
- 可选麦克风音高判定；没有麦克风权限时仍可跟着练习
- 本地 JSON 曲谱导入和本地曲库管理
- PWA 安装、离线缓存和手机横屏练习

## 在线使用与 PWA 安装

1. 用手机或电脑打开线上地址。
2. 手机建议横屏练习。
3. 浏览器提示安装时，可以添加到桌面或主屏幕。
4. 已安装 PWA 后，联网打开一次会更新离线包；出现“立即更新”提示时点击即可切换到新版本。

如果手机仍打开旧版本，可以先联网打开线上页面，等待更新提示；必要时在浏览器或系统设置里清理该站点缓存后重新安装。

## 本地启动

需要本机已安装 Node.js。

```powershell
npm start
```

或：

```powershell
node serve-kalimba.js
```

电脑访问：

```text
http://localhost:8123/index.html
```

手机局域网访问：

1. 电脑和手机连接同一个 Wi-Fi。
2. 在电脑终端运行 `node serve-kalimba.js`。
3. 终端会打印 `Phone on same Wi-Fi` 开头的地址。
4. 用手机浏览器打开该地址。

## 导入本地曲谱

1. 打开曲库页。
2. 点击“添加歌曲”。
3. 复制页面里的 AI 提示词，用简谱照片或已有资料生成 JSON。
4. 粘贴 JSON 并保存。

导入的曲谱保存在浏览器本地存储中，不会写入仓库。JSON 可以只包含主旋律，也可以包含和弦目标音、自动伴奏和节奏休止信息；App 会按数据自动生成可切换版本。

## 贡献与开发

- 开发者和 AI 代理请先读 [AGENTS.md](./AGENTS.md)。
- 新歌曲库格式见 [docs/SONG_LIBRARY.md](./docs/SONG_LIBRARY.md)。
- 简谱照片编译流程见 [docs/SCORE_COMPILER.md](./docs/SCORE_COMPILER.md)。
- 发布流程见 [docs/RELEASE.md](./docs/RELEASE.md)。
- 贡献说明见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 许可证与曲谱来源

项目代码开源协作，但现代歌曲曲谱、照片、OCR 中间结果和复核记录可能涉及版权。请不要把未经授权的原始曲谱照片或 OCR 文本提交到公开仓库。
