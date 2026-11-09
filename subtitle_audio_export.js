/*
 * subtitle_audio_export.js
 * Import SRT/VTT (đã được subtitle_voice_player.html phân tích) -> (tùy chọn) dịch -> TTS Piper ->
 * co giãn từng câu cho khớp mốc -> trộn thành 1 track -> xuất WAV / MP3. Không cần phát/ghi âm tab.
 *
 * Phần "lõi" (trimSilence, wsolaStretch, buildTimeline, encodeWav, parse/format SRT) là hàm thuần,
 * chạy được cả trong Node để kiểm tra (module.exports ở cuối file).
 */
(() => {
'use strict';

/* ───────────────────────── Lõi xử lý âm thanh (thuần JS) ───────────────────────── */

/** Cắt khoảng lặng đầu/cuối để giọng bắt đầu đúng mốc start của phụ đề. */
function trimSilence(x, sr, threshold = 0.012, keep = 0.015) {
  let a = 0, b = x.length - 1;
  while (a < x.length && Math.abs(x[a]) < threshold) a++;
  while (b > a && Math.abs(x[b]) < threshold) b--;
  if (a >= b) return new Float32Array(0);
  const k = Math.round(keep * sr);
  a = Math.max(0, a - k); b = Math.min(x.length - 1, b + k);
  return x.slice(a, b + 1);
}

/**
 * Co giãn thời gian giữ nguyên cao độ (WSOLA). rate > 1 => nhanh hơn / ngắn hơn.
 * Độ dài ra ≈ x.length / rate.
 */
function wsolaStretch(x, rate, sr) {
  if (!(rate > 1.005) || x.length < 64) return x;
  let N = Math.round(sr * 0.032); N += N % 2;               // độ dài khung (chẵn)
  const Hs = N / 2;                                         // bước tổng hợp (overlap 50%)
  const Ha = Hs * rate;                                     // bước phân tích
  const tol = Math.round(sr * 0.012);                       // vùng tìm kiếm ± 12 ms
  const outLen = Math.ceil(x.length / rate) + N;
  const out = new Float32Array(outLen), norm = new Float32Array(outLen);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const at = i => (i >= 0 && i < x.length ? x[i] : 0);
  let prev = 0;
  for (let k = 0; ; k++) {
    const outPos = k * Hs;
    if (outPos >= outLen - N) break;
    const target = Math.round(k * Ha);
    if (target >= x.length) break;
    let pos = target;
    if (k > 0) {
      const ref = prev + Hs;                                // đoạn nối tiếp tự nhiên của khung trước
      let best = -Infinity;
      for (let d = -tol; d <= tol; d += 2) {
        const p = target + d;
        if (p < 0) continue;
        let c = 0;
        for (let i = 0; i < Hs; i += 2) c += at(p + i) * at(ref + i);
        if (c > best) { best = c; pos = p; }
      }
    }
    for (let i = 0; i < N; i++) { out[outPos + i] += win[i] * at(pos + i); norm[outPos + i] += win[i]; }
    prev = pos;
  }
  const len = Math.round(x.length / rate);
  const res = new Float32Array(len);
  for (let i = 0; i < len; i++) res[i] = norm[i] > 1e-3 ? out[i] / norm[i] : 0;
  return res;
}

function fadeOut(x, from, sr, ms = 40) {
  const n = Math.min(Math.round(sr * ms / 1000), x.length - from);
  for (let i = 0; i < n; i++) x[from + i] *= 1 - (i + 1) / n;
}

/**
 * Đặt từng clip vào đúng mốc start của cue rồi cộng lại thành 1 track mono.
 * cues: [{start,end}], clips: [Float32Array|null] (đã ở tần số sr).
 * Trả về {samples, report}. report[i].status: ok | fast | overflow | cut | empty
 */
function buildTimeline({ cues, clips, sr, maxRate = 2, volume = 1, tail = 0.4 }) {
  const items = [];
  const report = [];
  let endSample = 0;
  cues.forEach((c, i) => {
    let x = clips[i];
    if (!x || !x.length) { report.push({ i, status: 'empty', natural: 0, rate: 1 }); return; }
    x = trimSilence(x, sr);
    if (!x.length) { report.push({ i, status: 'empty', natural: 0, rate: 1 }); return; }
    const natural = x.length / sr;
    const slot = Math.max(0.05, c.end - c.start);
    const next = cues[i + 1];
    const hardLimit = next ? Math.max(slot, next.start - c.start - 0.03) : slot + 2;
    let rate = 1, status = 'ok';
    if (natural > slot * 1.02) {
      rate = Math.min(natural / slot, Math.max(1, maxRate));
      if (rate > 1.02) { x = wsolaStretch(x, rate, sr); status = 'fast'; }
    }
    let dur = x.length / sr;
    if (dur > slot + 0.02) status = 'overflow';
    if (dur > hardLimit) {
      x = x.slice(0, Math.round(hardLimit * sr));
      fadeOut(x, Math.max(0, x.length - Math.round(sr * 0.04)), sr);
      status = 'cut'; dur = x.length / sr;
    }
    const offset = Math.round(c.start * sr);
    items.push({ x, offset });
    endSample = Math.max(endSample, offset + x.length);
    report.push({ i, status, natural, rate, dur });
  });
  const lastCueEnd = cues.length ? Math.max(...cues.map(c => c.end)) : 0;
  const total = Math.max(endSample, Math.round(lastCueEnd * sr)) + Math.round(tail * sr);
  const samples = new Float32Array(total);
  for (const { x, offset } of items) for (let i = 0; i < x.length; i++) samples[offset + i] += x[i];
  let peak = 0;
  for (let i = 0; i < samples.length; i++) { const a = Math.abs(samples[i]); if (a > peak) peak = a; }
  const gain = (peak > 0.98 ? 0.98 / peak : 1) * volume;
  if (gain !== 1) for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return { samples, report };
}

/** WAV PCM 16-bit mono. */
function encodeWav(samples, sr) {
  const buf = new ArrayBuffer(44 + samples.length * 2), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true);
  }
  return new Uint8Array(buf);
}

const pad = (n, w) => String(n).padStart(w, '0');
function fmtSrtTime(t) {
  const ms = Math.round(Math.max(0, t) * 1000);
  return pad(Math.floor(ms / 3600000), 2) + ':' + pad(Math.floor(ms % 3600000 / 60000), 2) + ':' +
    pad(Math.floor(ms % 60000 / 1000), 2) + ',' + pad(ms % 1000, 3);
}
/** Dựng lại SRT với mốc thời gian gốc và lời đã dịch (giữ "Tên: lời thoại" nếu có). */
function buildSrt(cues, texts) {
  return cues.map((c, i) => (i + 1) + '\n' + fmtSrtTime(c.start) + ' --> ' + fmtSrtTime(c.end) + '\n' +
    (c._speaker ? c._speaker + ': ' : '') + texts[i] + '\n').join('\n');
}

const api = { trimSilence, wsolaStretch, buildTimeline, encodeWav, buildSrt, fmtSrtTime };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof document === 'undefined') return;   // Node: dừng ở đây

/* ───────────────────────── Dịch ───────────────────────── */

const shortLang = code => String(code || '').split('-')[0].toLowerCase();
const wait = ms => new Promise(r => setTimeout(r, ms));

function splitForApi(text, max = 450) {
  if (text.length <= max) return [text];
  const parts = text.match(/[^.!?。！？…]+[.!?。！？…]*\s*/g) || [text], out = [];
  let cur = '';
  for (const p of parts) { if ((cur + p).length > max && cur) { out.push(cur.trim()); cur = p; } else cur += p; }
  if (cur.trim()) out.push(cur.trim());
  return out.flatMap(s => s.length > max ? s.match(new RegExp('.{1,' + max + '}', 'g')) : [s]);
}

async function translateAll(texts, src, tgt, engine, onProgress, isCancelled) {
  if (engine === 'none' || src === tgt) return texts.slice();
  const out = [];
  if (engine === 'chrome') {
    if (!('Translator' in self)) throw new Error('Trình duyệt chưa có Translator API (cần Chrome 138+/Edge 148+ trên máy tính). Hãy đổi sang “MyMemory” hoặc dùng bản dịch có sẵn.');
    const status = await Translator.availability({ sourceLanguage: src, targetLanguage: tgt });
    if (status === 'unavailable') throw new Error('Chrome không hỗ trợ cặp ngôn ngữ ' + src + ' → ' + tgt + '.');
    const translator = await Translator.create({
      sourceLanguage: src, targetLanguage: tgt,
      monitor(m) { m.addEventListener('downloadprogress', e => onProgress('Tải mô hình dịch ' + Math.round(e.loaded * 100) + '%', null)); }
    });
    for (let i = 0; i < texts.length; i++) {
      if (isCancelled()) throw new Error('Đã hủy.');
      onProgress('Dịch ' + (i + 1) + '/' + texts.length, i / texts.length);
      out.push(texts[i].trim() ? await translator.translate(texts[i]) : '');
    }
    return out;
  }
  if (engine === 'mymemory') {
    const map = c => (c === 'zh' ? 'zh-CN' : c);
    for (let i = 0; i < texts.length; i++) {
      if (isCancelled()) throw new Error('Đã hủy.');
      onProgress('Dịch ' + (i + 1) + '/' + texts.length, i / texts.length);
      if (!texts[i].trim()) { out.push(''); continue; }
      const pieces = [];
      for (const part of splitForApi(texts[i])) {
        const r = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(part) + '&langpair=' + map(src) + '|' + map(tgt));
        if (!r.ok) throw new Error('MyMemory trả lỗi HTTP ' + r.status + '.');
        const j = await r.json();
        if (Number(j.responseStatus) !== 200 || /MYMEMORY WARNING/i.test(j.responseData?.translatedText || ''))
          throw new Error('MyMemory từ chối (có thể đã hết hạn mức miễn phí trong ngày): ' + (j.responseDetails || j.responseStatus));
        pieces.push(j.responseData.translatedText);
        await wait(120);
      }
      out.push(pieces.join(' '));
    }
    return out;
  }
  throw new Error('Chưa chọn cách dịch hợp lệ.');
}

/* ───────────────────────── Giọng Piper ───────────────────────── */

const VOICES_URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/voices.json';
const FALLBACK_VOICES = [   // chỉ dùng khi không tải được voices.json
  'vi_VN-vais1000-medium', 'en_US-lessac-medium', 'en_GB-alan-medium', 'es_ES-davefx-medium', 'es_MX-claude-high',
  'fr_FR-siwis-medium', 'de_DE-thorsten-medium', 'pt_BR-faber-medium', 'zh_CN-huayan-medium'
].map(key => ({ key, code: key.split('-')[0], quality: key.split('-').pop() }));
let allVoices = null;

async function loadVoiceCatalog() {
  if (allVoices) return allVoices;
  try {
    const r = await fetch(VOICES_URL);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    allVoices = Object.entries(j).map(([key, v]) => ({ key, code: v.language?.code || key.split('-')[0], quality: v.quality || key.split('-').pop() }));
  } catch (e) { console.warn('[SubtitleAudio] Không tải được voices.json, dùng danh sách dự phòng:', e); allVoices = FALLBACK_VOICES; }
  return allVoices;
}
const QRANK = { medium: 0, high: 1, low: 2, x_low: 3 };
function voicesFor(langCode, list) {
  const fam = shortLang(langCode), loc = String(langCode).replace('-', '_').toLowerCase();
  return list.filter(v => v.code.toLowerCase().startsWith(fam + '_'))
    .sort((a, b) => ((b.code.toLowerCase() === loc) - (a.code.toLowerCase() === loc)) || ((QRANK[a.quality] ?? 9) - (QRANK[b.quality] ?? 9)) || a.key.localeCompare(b.key));
}

/* ───────────────────────── Giao diện ───────────────────────── */

const $ = id => document.getElementById(id);
let cancelled = false, busy = false, piperMod = null, session = null, sessionVoice = '', lastUrls = [];
const ttsCache = new Map(), transCache = new Map();

const status = (s, p) => { $('axStatus').textContent = s; if (Number.isFinite(p)) $('axProgress').value = p; };
const subApi = () => window.VNSubtitle;
const baseName = () => (($('filename').textContent || '').replace(/^✓\s*/, '').replace(/\s·.*$/, '').replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '')) || 'subtitle';

function initPanel() {
  const target = $('axTarget'), src = $('lang');
  target.innerHTML = src.innerHTML;
  target.value = src.value;
  const refreshVoices = async () => {
    const sel = $('axVoice'); sel.innerHTML = '<option value="">Đang tải danh sách giọng…</option>';
    const list = voicesFor(target.value, await loadVoiceCatalog());
    sel.innerHTML = list.length ? list.map((v, i) => '<option value="' + v.key + '">' + (i === 0 ? '★ ' : '') + v.key + '</option>').join('')
      : '<option value="">Piper chưa có giọng cho ngôn ngữ này</option>';
    $('axExport').disabled = busy || !list.length || !(subApi()?.cues.length);
  };
  let touched = false;   // chưa chủ động chọn ngôn ngữ đích => luôn theo ngôn ngữ phụ đề (tránh dịch ngoài ý muốn)
  const follow = () => { if (!touched && target.value !== src.value) { target.value = src.value; refreshVoices(); } };
  target.addEventListener('change', () => { touched = true; refreshVoices(); });
  src.addEventListener('change', follow);
  document.addEventListener('vn-subtitle-changed', () => { follow(); $('axExport').disabled = busy || !subApi()?.cues.length || !$('axVoice').value; });
  $('axEngine').addEventListener('change', () => { $('axEngineNote').textContent = engineNote(); });
  $('axEngineNote').textContent = engineNote();
  $('axExport').addEventListener('click', run);
  $('axCancel').addEventListener('click', () => { cancelled = true; status('Đang hủy…'); });
  $('axSrtBtn').addEventListener('click', () => { if (window.__axSrt) download(new Blob([window.__axSrt], { type: 'text/plain;charset=utf-8' }), baseName() + '_' + target.value + '.srt'); });
  refreshVoices();
}
function engineNote() {
  const e = $('axEngine').value;
  return e === 'chrome' ? ('Translator' in self ? 'Dịch ngay trên máy (Chrome/Edge máy tính), miễn phí, tự tải mô hình ngôn ngữ lần đầu.' : '⚠ Trình duyệt này chưa hỗ trợ Translator API — hãy chọn MyMemory.')
    : e === 'mymemory' ? 'Dịch online qua MyMemory (miễn phí, giới hạn số ký tự mỗi ngày; nội dung phụ đề được gửi tới máy chủ của họ).'
    : 'Giữ nguyên lời trong file phụ đề, chỉ đọc thành âm thanh.';
}
function download(blob, name) {
  const u = URL.createObjectURL(blob); lastUrls.push(u);
  const a = document.createElement('a'); a.href = u; a.download = name; a.click();
  return u;
}

async function getSession(voiceId) {
  if (session && sessionVoice === voiceId) return session;
  if (!piperMod) piperMod = await import('https://esm.sh/@realtimex/piper-tts-web@1.1.1');
  session = new piperMod.TtsSession({ voiceId, allowLocalModels: true, fallbackStrategy: 'cdn' });
  sessionVoice = voiceId; return session;
}

async function run() {
  const S = subApi();
  if (!S || !S.cues.length) { status('Hãy import file phụ đề trước.'); return; }
  const cues = S.cues.map(c => ({ start: c.start, end: c.end, text: c.text, _speaker: c._speaker }));
  const tgt = $('axTarget').value, srcCode = shortLang(S.lang), tgtCode = shortLang(tgt);
  const engine = $('axEngine').value, voiceId = $('axVoice').value, sr = Number($('axRate').value) || 44100;
  const format = $('axFormat').value, maxRate = Number($('maxRate').value) || 2, volume = Number($('volume').value);
  if (!voiceId) { status('Chưa có giọng Piper cho ngôn ngữ đã chọn.'); return; }
  if (format === 'mp3' && !window.lamejs) { status('Chưa tải được bộ mã hóa MP3 (lamejs). Kiểm tra mạng rồi tải lại trang, hoặc chọn WAV.'); return; }
  cancelled = false; busy = true; $('axExport').disabled = true; $('axCancel').disabled = false; $('axResult').hidden = true;
  let ctx;
  try {
    /* 1. Dịch (nếu cần) */
    let texts = cues.map(c => c.text);
    if (engine !== 'none' && srcCode !== tgtCode) {
      const key = engine + '|' + srcCode + '|' + tgtCode + '|' + texts.join('\u0001');
      if (!transCache.has(key)) transCache.set(key, await translateAll(texts, srcCode, tgtCode, engine, (m, p) => status(m, Number.isFinite(p) ? p * 20 : undefined), () => cancelled));
      texts = transCache.get(key);
    }
    window.__axSrt = buildSrt(cues, texts); $('axSrtBtn').disabled = false;

    /* 2. TTS từng câu bằng Piper */
    status('Đang nạp Piper và giọng ' + voiceId + '…', 20);
    const piper = await getSession(voiceId);
    ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: sr });   // decode sẽ tự resample về sr
    const clips = [];
    for (let i = 0; i < cues.length; i++) {
      if (cancelled) throw new Error('Đã hủy.');
      const text = texts[i].trim();
      status('Tạo giọng ' + (i + 1) + '/' + cues.length, 20 + Math.round(i / cues.length * 65));
      if (!text || !/[\p{L}\p{N}]/u.test(text)) { clips.push(null); continue; }
      const ck = voiceId + '|' + sr + '|' + text;
      if (!ttsCache.has(ck)) {
        try {
          const wav = await piper.predict(text);
          const ab = await ctx.decodeAudioData(await wav.arrayBuffer());
          ttsCache.set(ck, ab.getChannelData(0).slice());
        } catch (e) { console.warn('[SubtitleAudio] Câu ' + (i + 1) + ' lỗi TTS:', e); ttsCache.set(ck, null); }
      }
      clips.push(ttsCache.get(ck));
    }

    /* 3. Đặt vào mốc thời gian + co giãn cho khớp */
    status('Đang canh mốc thời gian và trộn…', 87);
    await wait(0);
    const { samples, report } = buildTimeline({ cues, clips, sr, maxRate, volume });

    /* 4. Mã hóa */
    status('Đang mã hóa ' + format.toUpperCase() + '…', 92);
    let blob;
    if (format === 'wav') blob = new Blob([encodeWav(samples, sr)], { type: 'audio/wav' });
    else {
      const enc = new lamejs.Mp3Encoder(1, sr, 128), parts = [], block = 1152;
      const pcm = new Int16Array(block);
      for (let pos = 0; pos < samples.length; pos += block) {
        if (cancelled) throw new Error('Đã hủy.');
        const len = Math.min(block, samples.length - pos), buf = len === block ? pcm : new Int16Array(len);
        for (let j = 0; j < len; j++) { const s = Math.max(-1, Math.min(1, samples[pos + j])); buf[j] = s < 0 ? s * 32768 : s * 32767; }
        const chunk = enc.encodeBuffer(buf); if (chunk.length) parts.push(new Uint8Array(chunk));
        if ((pos / block) % 400 === 0) await wait(0);
      }
      const tail = enc.flush(); if (tail.length) parts.push(new Uint8Array(tail));
      blob = new Blob(parts, { type: 'audio/mpeg' });
    }

    /* 5. Kết quả */
    const name = baseName() + '_' + tgt + '.' + format;
    const u = download(blob, name);
    $('axPreview').src = u; $('axLink').href = u; $('axLink').download = name; $('axLink').textContent = '⬇ Tải lại ' + name; $('axResult').hidden = false;
    const cnt = s => report.filter(r => r.status === s).length;
    const bad = report.filter(r => r.status === 'cut' || r.status === 'overflow').map(r => r.i + 1);
    status('Hoàn tất · ' + name + ' · ' + (blob.size / 1048576).toFixed(2) + ' MB · ' + (samples.length / sr).toFixed(1) + ' giây. ' +
      'Tăng tốc ' + cnt('fast') + ' câu, tràn quá mốc kết thúc ' + cnt('overflow') + ', bị ngắt ' + cnt('cut') + ', trống/lỗi ' + cnt('empty') + '.' +
      (bad.length ? ' Câu cần xem lại (quá dài so với thời gian): ' + bad.slice(0, 25).join(', ') + (bad.length > 25 ? '…' : '') + '.' : ''), 100);
  } catch (e) {
    console.error('[SubtitleAudio]', e); status('Không xuất được: ' + (e.message || e));
  } finally {
    try { await ctx?.close(); } catch (_) {}
    busy = false; $('axCancel').disabled = true; $('axExport').disabled = !subApi()?.cues.length || !$('axVoice').value;
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPanel); else initPanel();
})();
