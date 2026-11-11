# android-hls-offline-extractor

[简体中文](README.zh-CN.md) | **English**

Convert HLS media that an Android app has already downloaded to local storage into playable MP4 files. The code works on local caches. It does not handle online authorization, undownloaded content, or account access.

## Usage limits

Use this for personal study backups of content you paid for. Do not use it commercially or for profit. Do not share, upload, redistribute, resell, or sell access to the output. Check the app's terms and local law before you use it.

## Files

- `keygen.c`: runs on the Android device and calls `KeyManager` to derive a 16-byte AES key for each video.
- `keytest.c`: single-video debug harness that writes the key to `out.key`.
- `batch_process.js`: decrypts segments in m3u8 order, concatenates them, and remuxes to MP4 with ffmpeg. Reads `OUT`, `TARGET_COURSES`, and `LOG` from the environment and finds existing outputs recursively.
- `verify_output.js`: checks that each output exists and compares its duration with the metadata. Accepts the same `OUT` and `TARGET_COURSES` values.
- `courses.example.json`: sample course ID to name mapping. Copy it to `courses.json` and add your own entries.
- `docs/chapter-organizing.md`: how to group finished files by textbook chapter without breaking re-runs.

## Requirements

- Node.js 18 or newer
- ffmpeg and ffprobe
- Android NDK r27c, or another NDK with an arm64 clang
- An arm64 Android device with adb debugging enabled
- `keytool` from a JDK, used to read the APK v1 certificate SHA-1

## Setup

1. Extract the arm64 `libsaasCorePlayer.so` and `android.dat` from the target app's APK. `android.dat` may also live in the app's external files directory.
2. Read the APK v1 certificate SHA-1:

   ```bash
   keytool -printcert -jarfile <app.apk>
   ```

   Use the full uppercase, colon-separated fingerprint. Keep the real value out of this repository.

3. Build `keygen`:

   ```bash
   NDK=/path/to/android-ndk-r27c/toolchains/llvm/prebuilt/<host>/bin/aarch64-linux-android24-clang
   "$NDK" keygen.c -o keygen -ldl -llog -landroid -lz -lm
   ```

4. Push the files to the device:

   ```bash
   adb shell "mkdir -p /data/local/tmp/keytest"
   adb push keygen libsaasCorePlayer.so android.dat /data/local/tmp/keytest/
   adb shell "chmod 755 /data/local/tmp/keytest/keygen"
   ```

## Generate keys

Create `m3u8_dates.txt` with one line per video: `<m3u8 filename> <DATE>`. Read the DATE from the `#EXT-X-KEY` line in the m3u8:

```text
<uuid>_0.m3u8 1700000000000000
```

Run the key generator on the device:

```bash
adb push m3u8_dates.txt /data/local/tmp/keytest/dates.txt
adb shell "cd /data/local/tmp/keytest && ./keygen android.dat '<APK_V1_CERT_SHA1>' dates.txt keys.txt"
adb pull /data/local/tmp/keytest/keys.txt keys.txt
```

Each line in `keys.txt` contains `<m3u8 filename> <32-character hex key>`. If a line shows `FAIL`, check the fingerprint, the `android.dat` version, and the DATE for that video.

## Process the cache

Place the cache under `raw_all/` with its original structure:

```text
raw_all/
  <uuid>_0.m3u8
  <uuid>_0/000000.ts
  ...
  <uuid>_log
```

Copy `courses.example.json` to `courses.json`, add your course IDs and names, then run:

```bash
node batch_process.js
node verify_output.js
```

By default, output goes to `output/`. Set `OUT` and `TARGET_COURSES` to use another library and a subset:

```bash
OUT=/path/to/videos TARGET_COURSES=YOUR_COURSE_ID node batch_process.js
OUT=/path/to/videos TARGET_COURSES=YOUR_COURSE_ID node verify_output.js
```

On PowerShell:

```powershell
$env:OUT='D:\videos'; $env:TARGET_COURSES='YOUR_COURSE_ID'; node batch_process.js
```

Output goes to `<OUT>/<course name>/<video_id>_<video name>.mp4`. Files may be reorganized into chapter subfolders; both scripts find existing outputs recursively. `verify_output.js` reports `DURATION` when the output and metadata differ by more than 10 seconds.

## Organize by chapter

Finished files can be grouped by textbook chapter. See [chapter organization](docs/chapter-organizing.md). The scripts do not require a flat directory; keep `video_id` in filenames so re-runs can skip organized outputs.

## Notes

- Keep `android.dat`, `libsaasCorePlayer.so`, APK files, `keys.txt`, `m3u8_dates.txt`, `courses.json`, chapter mapping JSON, CSV indexes, `raw_all/`, and `output/` out of the repository. `.gitignore` covers these paths.
- The `/data/local/tmp/keytest` paths in `keygen.c` and `keytest.c` are temporary device paths. Change them if needed.
- The code depends on the target app's current `KeyManager` symbols and arguments. After an app update, confirm the symbols and signature check again.
