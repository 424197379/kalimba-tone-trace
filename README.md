# 卡林巴循音

英文工程名：Kalimba ToneTrace  
当前版本：1.0.3

一个面向 21 音卡林巴的本地优先练习 App。核心功能是听音识别与跟练：用下落块提示目标音，通过麦克风判断弹奏音高；麦克风权限不可用时仍可进入跟练模式。

## 当前功能

- 下落块练习轨道
- 横向简谱进度
- 多首歌曲切换
- 独立曲库搜索与选曲
- 本地 JSON 曲谱导入
- 示范播放
- 手机横屏展示
- 琴键宽度缩放
- Web Audio 卡林巴合成音色
- 可选麦克风识别
- PWA 离线缓存
- 手机桌面图标

## 启动

双击：

```bat
start-kalimba.cmd
```

或在当前目录运行：

```bat
npm start
```

也可以直接运行：

```bat
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
5. 手机建议横屏使用。

## 离线 App 路线

本项目已经整理成 PWA。要让手机“像 App 一样”离线打开，需要先通过 HTTPS 地址安装一次，例如 GitHub Pages、Cloudflare Pages 或其他 HTTPS 静态托管。

局域网 `http://电脑IP:8123` 适合调试，但手机浏览器通常不会把它当成安全上下文，所以 Service Worker 离线安装和麦克风识别可能受限。`localhost` 在电脑上可以用于本地测试。

## 更新版本

发布新版时同步修改：

- `package.json` 里的 `version`
- `index.html` 里的 `appVersionText` 占位版本
- `src/app.js` 里的 `APP_VERSION`
- `service-worker.js` 里的 `APP_VERSION`
- `CHANGELOG.md` 里的版本记录
- `changelog.html` 里的线上更新日志

版本号变化后，Service Worker 会创建新的缓存名，手机端联网打开一次后会更新离线包。

## 文件结构

```text
index.html                 PWA 主入口
songs.html                 曲库和搜索选曲页面
kalimba-practice.html      旧地址兼容跳转页
manifest.webmanifest       PWA 安装信息
service-worker.js          离线缓存逻辑
package.json               工程名、版本号和启动脚本
CHANGELOG.md               每个版本的更新记录
changelog.html             GitHub Pages 可直接打开的更新日志
serve-kalimba.js           本地局域网静态服务器
start-kalimba.cmd          Windows 快速启动脚本
src/
  app.js                   练习运行逻辑、音频、麦克风、界面事件
  pitch.js                 音高检测与最近琴键匹配
  song-library.js          曲库页面逻辑
  song-store.js            内置曲库、本地曲库和导入校验
  songs.js                 琴键定义与曲库
  styles.css               页面样式
assets/
  icons/                   PWA 图标
  source/                  自绘木质卡林巴图标源图
```

## 图标

当前图标是项目内自绘生成的普通木质卡林巴图标，没有使用网络图片素材。
