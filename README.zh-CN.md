# android-hls-offline-extractor

**简体中文** | [English](README.md)

把 Android App 已下载到本机的 HLS 加密缓存还原为可直接播放的 MP4。代码只处理本地缓存，不处理在线鉴权、未下载内容或账号权限。

## 使用限制

仅限个人已付费内容的个人学习备份。不得用于商业或盈利用途；不得传播、上传、分享、转售或付费分发。使用前确认平台协议和当地法律允许这种备份。

## 文件

- `keygen.c`：在 Android 设备上批量调用 `KeyManager`，为每个视频取出 16 字节 AES 密钥。
- `keytest.c`：单视频调试版，把密钥写到 `out.key`。
- `batch_process.js`：按 m3u8 顺序解密分片、合并，再用 ffmpeg 无损封装成 MP4。从环境变量读取 `OUT`、`TARGET_COURSES`、`LOG`，并递归查找已有输出。
- `verify_output.js`：检查输出是否存在，并比对时长。接受相同的 `OUT` 和 `TARGET_COURSES`。
- `courses.example.json`：课程 ID 到课程名的示例映射。复制为 `courses.json` 后填入自己的数据。
- `docs/chapter-organizing.zh-CN.md`：按教材章节整理输出，同时保持重跑可跳过。

## 依赖

- Node.js 18+
- ffmpeg 和 ffprobe
- Android NDK r27c，或其他带 arm64 clang 的 NDK
- 一台 arm64 Android 设备，已开启 adb 调试
- JDK 的 `keytool`，用来读取 APK v1 证书的 SHA-1

## 准备

1. 从目标 App 的安装包解出 arm64 的 `libsaasCorePlayer.so` 和 `android.dat`。`android.dat` 也可能在 App 的外部文件目录里。
2. 读取 APK v1 证书的 SHA-1：

   ```bash
   keytool -printcert -jarfile <app.apk>
   ```

   使用大写、冒号分隔的完整指纹，例如 `AA:BB:CC:...`。实际值不要写进仓库。

3. 编译 `keygen`：

   ```bash
   NDK=/path/to/android-ndk-r27c/toolchains/llvm/prebuilt/<host>/bin/aarch64-linux-android24-clang
   "$NDK" keygen.c -o keygen -ldl -llog -landroid -lz -lm
   ```

4. 推送到设备：

   ```bash
   adb shell "mkdir -p /data/local/tmp/keytest"
   adb push keygen libsaasCorePlayer.so android.dat /data/local/tmp/keytest/
   adb shell "chmod 755 /data/local/tmp/keytest/keygen"
   ```

## 生成密钥

准备 `m3u8_dates.txt`，每行是 `<m3u8 文件名> <DATE>`。DATE 从 m3u8 的 `#EXT-X-KEY` 行读取：

```text
<uuid>_0.m3u8 1700000000000000
```

在设备上运行：

```bash
adb push m3u8_dates.txt /data/local/tmp/keytest/dates.txt
adb shell "cd /data/local/tmp/keytest && ./keygen android.dat '<APK_V1_CERT_SHA1>' dates.txt keys.txt"
adb pull /data/local/tmp/keytest/keys.txt keys.txt
```

`keys.txt` 每行是 `<m3u8 文件名> <32 位十六进制密钥>`。出现 `FAIL` 时，先检查指纹、`android.dat` 版本和 DATE 是否对应。

## 处理缓存

把缓存按原结构放进 `raw_all/`：

```text
raw_all/
  <uuid>_0.m3u8
  <uuid>_0/000000.ts
  ...
  <uuid>_log
```

复制 `courses.example.json` 为 `courses.json`，填入课程 ID 和名称，然后运行：

```bash
node batch_process.js
node verify_output.js
```

默认输出到 `output/`。要指定视频库位置并只处理某门课：

```bash
OUT=/path/to/videos TARGET_COURSES=YOUR_COURSE_ID node batch_process.js
OUT=/path/to/videos TARGET_COURSES=YOUR_COURSE_ID node verify_output.js
```

PowerShell 示例：

```powershell
$env:OUT='D:\videos'; $env:TARGET_COURSES='YOUR_COURSE_ID'; node batch_process.js
```

输出在 `<OUT>/<课程名>/<video_id>_<视频名>.mp4`。文件可以再整理进章节目录，两个脚本都会递归查找已有输出。`verify_output.js` 检查时长差异，超过 10 秒会报 `DURATION`。

## 按章整理

转换完成的文件可以按教材章节分组，做法见 [分章整理说明](docs/chapter-organizing.zh-CN.md)。脚本不要求平铺目录，文件名里保留 `video_id` 就能在重跑时跳过已整理的文件。

## 注意

- 不要把 `android.dat`、`libsaasCorePlayer.so`、APK、`keys.txt`、`m3u8_dates.txt`、`courses.json`、分章映射 JSON、CSV 索引、`raw_all/`、`output/` 提交到仓库。`.gitignore` 已覆盖这些路径。
- `keygen.c` 和 `keytest.c` 里的 `/data/local/tmp/keytest` 是设备端临时目录，可以按需修改。
- 代码依赖目标 App 当前的 `KeyManager` 符号和参数。App 升级后先重新确认符号和签名校验方式。
