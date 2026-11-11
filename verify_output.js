const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const OUT = process.env.OUT || 'output';
const TARGET_COURSES = new Set(
  (process.env.TARGET_COURSES || '').split(',').map(s => s.trim()).filter(Boolean)
);
const courses = JSON.parse(fs.readFileSync('courses.json', 'utf8'));
function sanitize(s) {
  return String(s).replace(/[\\/:*?"<>|]/g, '_').replace(/[\s.]+$/g, '').slice(0, 120);
}
function listMp4(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listMp4(p));
    else if (e.name.endsWith('.mp4')) out.push(p);
  }
  return out;
}
function videoIdOf(file) {
  const m = path.basename(file).match(/^(?:\d{2}_)?(\d+)_/);
  return m ? m[1] : null;
}
const indexes = new Map();
function findOutput(courseName, videoId) {
  const dir = path.join(OUT, sanitize(courseName));
  if (!indexes.has(dir)) {
    const idx = new Map();
    for (const p of listMp4(dir)) {
      const id = videoIdOf(p);
      if (id && !idx.has(id)) idx.set(id, p);
    }
    indexes.set(dir, idx);
  }
  return indexes.get(dir).get(String(videoId)) || null;
}
const logs = fs.readdirSync('raw_all').filter(f => /_log$/.test(f));
let ok = 0, bad = 0, missing = 0, total = 0;
for (const ln of logs) {
  let j;
  try {
    j = JSON.parse(Buffer.from(fs.readFileSync(path.join('raw_all', ln), 'utf8').trim(), 'base64').toString('utf8'));
  } catch (e) { console.log('BADLOG', ln); bad++; continue; }
  if (TARGET_COURSES.size && !TARGET_COURSES.has(String(j.course_id))) continue;
  total++;
  const course = courses[String(j.course_id)]?.course_name || String(j.course_id);
  const p = findOutput(course, j.video_id);
  if (!p) { console.log('MISSING', course, j.video_id); missing++; continue; }
  const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', p], { encoding: 'utf8' }).trim());
  const meta = parseInt(j.duration, 10);
  if (Math.abs(dur - meta) > 10) { console.log('DURATION', p, dur, meta); bad++; }
  else ok++;
}
console.log(`ok=${ok} bad=${bad} missing=${missing} total=${total}`);
