# merge-m3u8

一个用于合并 IDM（Internet Download Manager）HLS 分片文件的命令行工具。

## 背景

使用 IDM 下载器下载 MP4 视频时，下载可能停留在 99.99% 不完成。此时下载缓存文件夹中会遗留一堆分片文件，文件名形如：

```
video.m3u81
video.m3u82
video.m3u83
...
```

这些分片实际上是完整视频被切分后的 MPEG-TS 数据块，可以按顺序拼接成完整视频。本工具会自动扫描这些分片、顺序合并，并调用系统已安装的 `ffmpeg` 封装成标准 MP4 文件。

## 环境要求

- **Node.js** >= 14.0.0
- **ffmpeg** 已安装并加入 PATH（或位于常见安装目录）

## 安装

```bash
# 全局安装（可选，便于直接命令行调用）
npm install -g .

# 或仅本地运行
npm install
```

## 使用方法

```bash
npm start                          # 合并当前目录下的分片
node src/cli.js                    # 同上
node src/cli.js "D:\Downloads\video"      # 指定分片所在目录
```

## 命令行选项

| 选项 | 说明 |
| ---- | ---- |
| `-o, --output <file>` | 输出文件名（默认 `output.mp4`；若已存在自动改名 `output (1).mp4`） |
| `-p, --prefix <prefix>` | 分片文件前缀（默认 `video.m3u8`） |
| `-a, --auto` | 自动模式，自动跳过疑似破损的分片 |
| `-t, --threshold <MB>` | 自动模式阈值（默认 `0.1` MB） |
| `-s, --skip <list>` | 手动跳过指定编号分片，逗号分隔（如 `1922,1923`） |
| `-k, --keep-temp` | 保留中间 concat 列表文件 `concat.*.txt` |
| `-h, --help` | 显示帮助信息 |

## 示例

```bash
# 1. 使用当前目录（交互式选择要跳过的分片）
npm start

# 2. 指定目录
node src/cli.js "D:\Downloads\my-video"

# 3. 自动模式（跳过可疑破损分片）
node src/cli.js "D:\Downloads\my-video" -a

# 4. 自动模式 + 自定义输出文件名
node src/cli.js "D:\Downloads\my-video" -a -o final-video.mp4

# 5. 自定义分片前缀
node src/cli.js "D:\Downloads\clip" -p "clip.m3u8"

# 6. 手动跳过特定分片
node src/cli.js "D:\Downloads\my-video" -s 1922,1923,1924
```

## 工作原理

1. **扫描**：读取分片所在目录，按数字顺序匹配 `video.m3u8N` 命名的分片文件。
2. **筛选**：交互式或自动模式（`-a`）下，识别过小/可疑的破损分片并可跳过。
3. **合成**：调用 `ffmpeg` 的 **concat demuxer** 一步完成「拼接 + 封装」，以 `-c copy` 不重编码输出标准 MP4（支持 `faststart` 便于网页播放）。

采用 ffmpeg 原生 `concat` 方式合成，由 C 代码完成拼接与封装，速度远快于用 Node.js 逐文件合并后再二次封装；期间仅生成一个小的分片列表 `concat.*.txt`，不会产生大体积中间文件。

**进度动效**：合并过程中，控制台会显示动态效果——进行中为旋转动画（`⠋` `⠙` `⠹`…）；收到 ffmpeg 实时输出字节后自动切换为百分比进度条 `[███░░░] 62.5%`；完成时定格 100%。非交互终端下则每 2 秒输出一个点，避免刷屏。

**多次合并不覆盖**：同一目录下多次运行会自动生成唯一文件名，例如 `output.mp4` 已存在时，本次结果写入 `output (1).mp4`、`output (2).mp4`…… 不会覆盖之前的产物。中间列表文件 `concat.*.txt` 每次运行使用唯一名称，结束后自动删除。

## 常见问题

**提示 "ffmpeg not found"**
确保 ffmpeg 已安装并添加到了系统 PATH。Windows 也可安装到 `C:\ffmpeg\bin` 或 `C:\Program Files\ffmpeg\bin`。

**视频无法在浏览器中播放**
确认工具已正确添加 `-movflags +faststart`（默认已启用）；若仍异常，可尝试保留临时文件并检查分片是否有遗漏：
```bash
node src/cli.js "D:\Downloads\my-video" -k
```

**合并后画面/时长异常**
通常是部分分片损坏或不完整所致。使用 `-a` 自动模式，或对照分片大小手动 `-s` 跳过异常分片。

## 许可证

[MIT](./LICENSE)
