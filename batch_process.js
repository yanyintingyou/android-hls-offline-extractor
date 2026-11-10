const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');

const ROOT = 'raw_all';
const OUT = 'output';
const LOG = 'process.log';

const courses = JSON.parse(fs.readFileSync('courses.json', 'utf8'));
const keys = {};
for (const line of fs.readFileSync('keys.txt', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\S+\.m3u8)\s+([0-9a-f]{32})$/);
  if (m) keys[m[1]] = Buffer.from(m[2], 'hex');
}

function sanitize(s) {
  return String(s).replace(/[\\/:*?"<>|]/g, '_').replace(/[\s.]+$/g, '').slice(0, 120);
}
function logLine(s) {
  fs.appendFileSync(LOG, s + '\n');
  console.log(s);
}
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => (err += d));
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}: ${err.slice(-500)}`)));
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(LOG, '');
  const logs = fs.readdirSync(ROOT).filter(f => /_log$/.test(f)).sort();
  logLine(`videos: ${logs.length}`);
  let ok = 0, skip = 0, fail = 0;
  for (let i = 0; i < logs.length; i++) {
    const logName = logs[i];
    let j;
    try {
      j = JSON.parse(Buffer.from(fs.readFileSync(path.join(ROOT, logName), 'utf8').trim(), 'base64').toString('utf8'));
    } catch (e) {
      logLine(`[${i + 1}/${logs.length}] BAD LOG ${logName}: ${e.message}`);
      fail++;
      continue;
    }
    const uuid = j.url;
    const m3u8Name = `${uuid}_0.m3u8`;
    const m3u8Path = path.join(ROOT, m3u8Name);
    const key = keys[m3u8Name];
    const course = courses[String(j.course_id)]?.course_name || String(j.course_id);
    const outDir = path.join(OUT, sanitize(course));
    const outName = `${j.video_id}_${sanitize(j.video_name)}.mp4`;
    const outPath = path.join(outDir, outName);
    const tag = `[${i + 1}/${logs.length}] ${j.course_id}/${j.video_id} ${j.video_name}`;
    if (!key || !fs.existsSync(m3u8Path)) {
      logLine(`${tag} SKIP missing key/m3u8`);
      skip++;
      continue;
    }
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1024) {
      ok++;
      continue;
    }
    const segs = fs.readFileSync(m3u8Path, 'utf8').split(/\r?\n/)
      .map(s => s.trim()).filter(s => s && !s.startsWith('#'));
    const missing = segs.find(s => !fs.existsSync(path.join(ROOT, s)));
    if (missing) {
      logLine(`${tag} PENDING missing ${path.basename(missing)}`);
      skip++;
      continue;
    }
    fs.mkdirSync(outDir, { recursive: true });
    const temp = path.join('.', `tmp_${uuid}.ts`);
    const out = fs.createWriteStream(temp);
    let bad = null;
    try {
      for (const seg of segs) {
        const segPath = path.join(ROOT, seg);
        const ct = fs.readFileSync(segPath);
        if (ct.length % 16 !== 0) throw new Error(`segment not 16-multiple: ${seg} ${ct.length}`);
        const d = crypto.createDecipheriv('aes-128-cbc', key, Buffer.alloc(16));
        d.setAutoPadding(false);
        const pt = Buffer.concat([d.update(ct), d.final()]);
        if (pt[0] !== 0x47) throw new Error(`bad sync byte in ${seg}`);
        out.write(pt);
      }
      await new Promise((res, rej) => out.end(err => err ? rej(err) : res()));
      await run('ffmpeg', ['-y', '-v', 'error', '-i', temp, '-map', '0:v:0', '-map', '0:a:0',
        '-c', 'copy', '-bsf:a', 'aac_adtstoasc', '-movflags', '+faststart', outPath]);
      const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=nw=1:nk=1', outPath], { encoding: 'utf8' }).trim();
      const d = parseFloat(dur);
      const m = parseInt(j.duration, 10);
      const warn = Math.abs(d - m) > 10 ? ` WARN duration ${d} vs ${m}` : '';
      ok++;
      logLine(`${tag} OK ${(fs.statSync(outPath).size / 1048576).toFixed(1)}MB ${d.toFixed(1)}s${warn}`);
    } catch (e) {
      fail++;
      try { out.destroy(); } catch (_) {}
      logLine(`${tag} FAIL ${e.message}`);
    } finally {
      try { fs.unlinkSync(temp); } catch (_) {}
    }
  }
  logLine(`DONE ok=${ok} skip=${skip} fail=${fail}`);
})();
