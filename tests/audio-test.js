// Audio Lab: manual audition + automated offline analysis of the audio module.

import {
  AudioSystem, SOUND_GROUPS, SOUND_NAMES, MUSIC_TRACKS,
  renderSoundOffline, renderMusicOffline, renderTransitionOffline, renderStressOffline, analyzeBuffer, getSharedBank,
  PRE_ROLL,
} from '../src/audio/audio.js';
import { SOUNDS } from '../src/audio/sfx/index.js';

const audio = new AudioSystem();
window.__audio = audio;

const $ = (id) => document.getElementById(id);
const state = {
  master: 1, sfx: 1, music: 1, intensity: 0.5, volume: 1, pitch: 1, note: 0,
  posX: 6, posZ: -6, slowmo: 0, danger: 0, musicIntensity: 0.5,
};
let lastHandle = null;

// ------------------------------------------------------------------ sliders

const SLIDERS = [
  ['master', 'master vol', 0, 1, 0.01, () => audio.setVolumes({ master: state.master })],
  ['sfx', 'sfx vol', 0, 1, 0.01, () => audio.setVolumes({ sfx: state.sfx })],
  ['music', 'music vol', 0, 1, 0.01, () => audio.setVolumes({ music: state.music })],
  ['intensity', 'intensity', 0, 1, 0.01],
  ['volume', 'volume', 0, 2, 0.01],
  ['pitch', 'pitch', 0.5, 2, 0.01],
  ['note', 'biwa note', -12, 24, 1],
  ['posX', 'pos X', -30, 30, 0.5],
  ['posZ', 'pos Z', -40, 10, 0.5],
  ['slowmo', 'slow-mo', 0, 1, 0.01],
  ['danger', 'danger', 0, 1, 0.01],
  ['musicIntensity', 'music intensity', 0, 1, 0.01, () => audio.setMusicIntensity(state.musicIntensity)],
];

for (const [key, label, min, max, step, onChange] of SLIDERS) {
  const wrap = document.createElement('label');
  wrap.className = 'slider';
  wrap.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${state[key]}"><output>${state[key]}</output>`;
  const input = wrap.querySelector('input');
  const out = wrap.querySelector('output');
  input.addEventListener('input', () => {
    state[key] = +input.value;
    out.textContent = (+input.value).toFixed(step < 1 ? 2 : 0);
    if (onChange) onChange();
  });
  $('sliders').appendChild(wrap);
}

// slow-mo and danger are "called every frame" in the game: emulate that here
function frame() {
  audio.setSlowmo(state.slowmo);
  audio.setDanger(state.danger);
  audio.setListener({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 1, y: 0, z: 0 });
  const d = audio.debug;
  $('status').innerHTML = audio.ready
    ? `ctx <b>${d.state}</b> · ${d.sampleRate} Hz · pre-render <b>${d.prerenderMs} ms</b> · voices <b>${d.voices}</b> · track <b>${d.track || '-'}</b>`
    : `audio locked (state ${d.state})`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ------------------------------------------------------------------ sound buttons

function optsFor(name) {
  const o = { intensity: state.intensity, volume: state.volume, pitch: state.pitch };
  if ($('positional').checked) o.pos = { x: state.posX, y: 0, z: state.posZ };
  if (name === 'biwa' && !$('randomNote').checked) o.note = state.note;
  return o;
}

function playSound(name) {
  const h = audio.play(name, optsFor(name));
  if (h) lastHandle = h;
  return h;
}

for (const [group, names] of Object.entries(SOUND_GROUPS)) {
  const h = document.createElement('h3');
  h.textContent = group;
  $('sounds').appendChild(h);
  const row = document.createElement('div');
  row.className = 'row';
  for (const name of names) {
    const b = document.createElement('button');
    b.textContent = name;
    b.addEventListener('click', () => playSound(name));
    row.appendChild(b);
  }
  $('sounds').appendChild(row);
}

// ------------------------------------------------------------------ music buttons

const musicButtons = [];
for (const track of [...MUSIC_TRACKS, null]) {
  const b = document.createElement('button');
  b.textContent = track || 'stop (null)';
  b.addEventListener('click', () => {
    audio.playMusic(track);
    musicButtons.forEach((x) => x.classList.toggle('on', x === b && track !== null));
  });
  musicButtons.push(b);
  $('music').appendChild(b);
}

// ------------------------------------------------------------------ engine buttons

$('unlock').addEventListener('click', async () => {
  $('unlock').textContent = 'Unlocking...';
  await audio.unlock();
  audio.setVolumes({ master: state.master, sfx: state.sfx, music: state.music });
  $('unlock').textContent = audio.ready ? 'Audio unlocked' : 'Unlock failed';
});
$('duck').addEventListener('click', () => audio.duck(0.6, 0.4));
$('stopLast').addEventListener('click', () => lastHandle && lastHandle.stop(0.2));
$('barrage').addEventListener('click', () => {
  let n = 0;
  const id = setInterval(() => {
    audio.play('barrage', optsFor('barrage'));
    if (++n >= 40) clearInterval(id);
  }, 50);
});
$('stress').addEventListener('click', () => {
  const names = ['hitSlash', 'punchHit', 'swingLight', 'hitBlunt', 'block', 'step', 'demonHurt', 'barrage', 'crack'];
  let n = 0;
  const id = setInterval(() => {
    for (let k = 0; k < 3; k++) {
      const name = names[(Math.random() * names.length) | 0];
      audio.play(name, { intensity: Math.random(), pos: { x: (Math.random() - 0.5) * 30, y: 0, z: -Math.random() * 20 } });
    }
    if (++n >= 60) clearInterval(id);
  }, 50);
});

// ------------------------------------------------------------------ analysis

const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : String(x));

function sparkline(buffer, dur, start = 0) {
  const cv = document.createElement('canvas');
  cv.width = 140;
  cv.height = 22;
  cv.className = 'spark';
  const g = cv.getContext('2d');
  const d = buffer.getChannelData(0);
  const i0 = Math.floor(start * buffer.sampleRate);
  const n = Math.min(d.length - i0, Math.ceil((dur || buffer.duration) * buffer.sampleRate));
  const step = Math.max(1, Math.floor(n / cv.width));
  g.fillStyle = '#3aa0c9';
  for (let x = 0; x < cv.width; x++) {
    let m = 0;
    for (let i = i0 + x * step; i < i0 + Math.min(n, (x + 1) * step); i++) m = Math.max(m, Math.abs(d[i]));
    const h = Math.max(1, m * cv.height);
    g.fillRect(x, (cv.height - h) / 2, 1, h);
  }
  return cv;
}

function addRow(cells, cls, spark, onClick) {
  const tr = document.createElement('tr');
  tr.className = cls;
  for (const c of cells) {
    const td = document.createElement('td');
    td.textContent = c;
    tr.appendChild(td);
  }
  tr.lastChild.className = 'flags';
  const td = document.createElement('td');
  if (spark) td.appendChild(spark);
  tr.appendChild(td);
  if (onClick) tr.addEventListener('click', onClick);
  $('results').appendChild(tr);
}

async function analyzeAll() {
  const btn = $('analyze');
  btn.disabled = true;
  const t0 = performance.now();
  const bank = audio.ready ? audio.debug.bank : await getSharedBank(48000);
  $('results').innerHTML =
    '<tr><th>name</th><th>dur s</th><th>max s</th><th>tail s</th><th>peak dBFS</th><th>raw dBFS</th><th>RMS dBFS</th><th>LUFS*</th><th>stress dBFS</th><th>render ms</th><th>flags</th><th>envelope</th></tr>';
  const rows = [];
  let fails = 0, warns = 0;
  for (const name of SOUND_NAMES) {
    btn.textContent = `Analyzing ${name}...`;
    const def = SOUNDS[name];
    const main = await renderSoundOffline(name, { intensity: 0.5 }, { bank });
    const raw = await renderSoundOffline(name, { intensity: 0.5 }, { bank, raw: true });
    const hot = await renderSoundOffline(name, { intensity: 1, volume: 2 }, { bank });
    const A = analyzeBuffer(main.buffer, main.voiceDur, main.start);
    const R = analyzeBuffer(raw.buffer, raw.voiceDur, raw.start);
    const S = analyzeBuffer(hot.buffer, hot.voiceDur, hot.start);
    const flags = [];
    if (A.nan || R.nan || S.nan) flags.push('NaN');
    if (A.peakDb < -50) flags.push('SILENT');
    if (A.peak > 1 || S.peak > 1) flags.push('CLIP');
    if (Math.max(main.voiceDur, hot.voiceDur) > def.maxDur + 0.02) flags.push('LONG');
    const fail = flags.length > 0;
    const warn = !fail && R.peakDb > 6;
    if (warn) flags.push('HOT(limited)');
    if (fail) fails++;
    if (warn) warns++;
    const row = {
      name, dur: main.voiceDur, maxDur: def.maxDur, tail: A.tail, peakDb: A.peakDb, rawDb: R.peakDb, rmsDb: A.rmsDb,
      lufs: A.lufs, stressDb: S.peakDb, renderMs: main.renderMs, flags, pass: !fail,
    };
    rows.push(row);
    addRow(
      [name, fmt(row.dur, 2), fmt(def.maxDur, 2), fmt(A.tail, 2), fmt(A.peakDb), fmt(R.peakDb), fmt(A.rmsDb), fmt(A.lufs), fmt(S.peakDb), fmt(main.renderMs, 0), flags.join(' ') || 'ok'],
      fail ? 'fail' : warn ? 'warn' : 'pass',
      sparkline(main.buffer, Math.max(main.voiceDur, 0.3) + 0.6, main.start),
      () => playSound(name),
    );
  }

  const musicRows = [];
  for (const track of MUSIC_TRACKS) {
    btn.textContent = `Rendering music ${track}...`;
    const m = await renderMusicOffline(track, 12, { bank, intensity: 0.6 });
    const A = analyzeBuffer(m.buffer, 12 - PRE_ROLL, PRE_ROLL);
    const flags = [];
    if (A.nan) flags.push('NaN');
    if (A.peakDb < -50) flags.push('SILENT');
    if (A.peak > 1) flags.push('CLIP');
    const fail = flags.length > 0;
    if (fail) fails++;
    musicRows.push({ track, peakDb: A.peakDb, rmsDb: A.rmsDb, lufs: A.lufs, renderMs: m.renderMs, flags, pass: !fail });
    addRow(['music:' + track, '12.00', '-', fmt(A.tail, 2), fmt(A.peakDb), '-', fmt(A.rmsDb), fmt(A.lufs), '-', fmt(m.renderMs, 0), flags.join(' ') || 'ok'],
      fail ? 'fail' : 'pass', sparkline(m.buffer, 12), () => audio.playMusic(track));
  }

  btn.textContent = 'Rendering boss -> boss2 handover...';
  const tr = await renderTransitionOffline({ bank });
  const T = analyzeBuffer(tr.buffer, 9 - PRE_ROLL, PRE_ROLL);
  const tFlags = [];
  if (T.nan) tFlags.push('NaN');
  if (T.peak > 1) tFlags.push('CLIP');
  if (T.peakDb < -50) tFlags.push('SILENT');
  const si = tr.switchInfo || {};
  const aligned = si.startsAt !== undefined && Math.abs((si.bar % 1)) < 1e-9;
  if (!aligned) tFlags.push('NOT-BAR-ALIGNED');
  if (tFlags.length) fails++;
  addRow(['boss->boss2', '9.00', '-', fmt(T.tail, 2), fmt(T.peakDb), '-', fmt(T.rmsDb), fmt(T.lufs), '-', fmt(tr.renderMs, 0),
    (tFlags.join(' ') || 'ok') + ` (req ${fmt(si.requestedAt, 2)}s -> bar ${si.bar} @ ${fmt(si.startsAt, 2)}s)`],
  tFlags.length ? 'fail' : 'pass', sparkline(tr.buffer, 9));

  btn.textContent = 'Rendering stress scene...';
  const st = await renderStressOffline({ bank, seconds: 4 });
  const SA = analyzeBuffer(st.buffer, 6 - PRE_ROLL, PRE_ROLL);
  const sFlags = [];
  if (SA.nan) sFlags.push('NaN');
  if (SA.peak > 1) sFlags.push('CLIP');
  if (st.peakVoices > 40) sFlags.push('VOICE-CAP');
  if (sFlags.length) fails++;
  addRow(['stress scene', '6.00', '-', fmt(SA.tail, 2), fmt(SA.peakDb), '-', fmt(SA.rmsDb), fmt(SA.lufs), '-', fmt(st.renderMs, 0),
    (sFlags.join(' ') || 'ok') + ` (${st.started}/${st.plays} started, peak voices ${st.peakVoices}, ${fmt(st.realtime, 1)}x realtime)`],
  sFlags.length ? 'fail' : 'pass', sparkline(st.buffer, 6));

  const total = SOUND_NAMES.length + MUSIC_TRACKS.length + 2;
  const secs = (performance.now() - t0) / 1000;
  const summary = `${total - fails}/${total} passed, ${warns} warnings, ${fails} failures · pre-render ${bank.renderMs} ms · analysis ${fmt(secs, 1)} s · sample rate ${bank.sr} Hz`;
  $('summary').textContent = summary + '\n* LUFS = K-weighted loudness over the sound (music: over 12 s).';
  window.__audioAnalysis = {
    summary, fails, warns, rows, musicRows,
    transition: { ...si, peakDb: T.peakDb, flags: tFlags },
    stress: { peakDb: SA.peakDb, renderMs: st.renderMs, realtime: st.realtime, peakVoices: st.peakVoices, plays: st.plays, started: st.started, flags: sFlags },
    prerenderMs: bank.renderMs,
  };
  btn.textContent = 'Analyze all';
  btn.disabled = false;
  return window.__audioAnalysis;
}

$('analyze').addEventListener('click', () => {
  analyzeAll().catch((e) => {
    console.error(e);
    $('summary').textContent = 'Analysis failed: ' + (e && e.message);
    $('analyze').disabled = false;
    $('analyze').textContent = 'Analyze all';
  });
});
window.__analyzeAll = analyzeAll;
