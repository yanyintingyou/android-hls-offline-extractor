const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const courses = JSON.parse(fs.readFileSync('courses.json', 'utf8'));
function sanitize(s) {
  return String(s).replace(/[\\/:*?"<>|]/g, '_').replace(/[\s.]+$/g, '').slice(0, 120);
}
const logs = fs.readdirSync('raw_all').filter(f => /_log$/.test(f));
let ok = 0, bad = 0, missing = 0;
for (const ln of logs) {
  let j;
  try {
    j = JSON.parse(Buffer.from(fs.readFileSync(path.join('raw_all', ln), 'utf8').trim(), 'base64').toString('utf8'));
  } catch (e) { console.log('BADLOG', ln); bad++; continue; }
  const course = courses[String(j.course_id)]?.course_name || String(j.course_id);
  const p = path.join('output', sanitize(course), `${j.video_id}_${sanitize(j.video_name)}.mp4`);
  if (!fs.existsSync(p)) { console.log('MISSING', p); missing++; continue; }
  const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', p], { encoding: 'utf8' }).trim());
  const meta = parseInt(j.duration, 10);
  if (Math.abs(dur - meta) > 10) { console.log('DURATION', p, dur, meta); bad++; }
  else ok++;
}
console.log(`ok=${ok} bad=${bad} missing=${missing} total=${logs.length}`);
