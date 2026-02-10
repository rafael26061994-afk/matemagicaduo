/* Relatório do Estudante — Matemágica (offline)
   - Gera código MMR1 + QR + JSON/CSV
   - Usa sessões salvas pelo app em: matemagica_sessions_v1
   - Usa erros salvos pelo app em: matemagica_errors
*/
(function(){
  'use strict';

  const PROFILE_KEY = 'matemagica_profile_v1';
  const SESSIONS_KEY = 'matemagica_sessions_v1';
  const ERRORS_KEY = 'matemagica_errors';
  const XP_KEY = 'matemagica_xp';

  const els = {
    profileSelect: document.getElementById('profile-select'),
    btnLoadProfile: document.getElementById('btn-load-profile'),
    inpName: document.getElementById('inp-name'),
    inpCode: document.getElementById('inp-code'),
    inpClass: document.getElementById('inp-class'),
    inpSchool: document.getElementById('inp-school'),
    periodSelect: document.getElementById('period-select'),
    btnGenerate: document.getElementById('btn-generate'),
    out: document.getElementById('report-output'),
    code: document.getElementById('report-code'),
    qr: document.getElementById('qrcode'),
    btnShowQr: document.getElementById('btn-show-qr'),
    btnCopy: document.getElementById('btn-copy-code'),
    btnJson: document.getElementById('btn-download-json'),
    btnCsv: document.getElementById('btn-download-csv'),
  };

  function safeParse(raw, fallback){
    try { return raw ? JSON.parse(raw) : fallback; } catch(_) { return fallback; }
  }

  function now(){ return Date.now(); }

  function startEndFromPeriod(value){
    const end = now();
    let start = end - 24*3600*1000; // default: 24h
    if (value === 'today') {
      const d = new Date();
      d.setHours(0,0,0,0);
      start = d.getTime();
    } else if (value === '7d') {
      start = end - 7*24*3600*1000;
    } else if (value === '30d') {
      start = end - 30*24*3600*1000;
    } else if (value === 'all') {
      start = 0;
    }
    return {start, end};
  }

  function b64EncodeUnicode(str){
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64DecodeUnicode(str){
    return decodeURIComponent(escape(atob(str)));
  }

  function readProfile(){
    const p = safeParse(localStorage.getItem(PROFILE_KEY), {});
    return {
      name: String(p?.name || '').trim(),
      turma: String(p?.turma || '').trim(),
      escola: String(p?.escola || '').trim(),
    };
  }

  function loadSessions(){
    const arr = safeParse(localStorage.getItem(SESSIONS_KEY), []);
    return Array.isArray(arr) ? arr : [];
  }

  function loadErrors(){
    const arr = safeParse(localStorage.getItem(ERRORS_KEY), []);
    return Array.isArray(arr) ? arr : [];
  }

  function loadXp(){
    const v = parseInt(localStorage.getItem(XP_KEY) || '0', 10);
    return Number.isFinite(v) ? v : 0;
  }

  function setOutput(html){
    els.out.innerHTML = html;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (m)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function fmtDate(ts){
    const d = new Date(ts);
    return d.toLocaleString('pt-BR');
  }

  function summarizeTop(arr, keyFn, n){
    const map = new Map();
    for (const it of arr){
      const k = keyFn(it);
      if (!k) continue;
      map.set(k, (map.get(k)||0) + 1);
    }
    const sorted = [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n);
    return sorted;
  }

  function makeCsv(report){
    const rows = [];
    rows.push(['schemaVersion','classId','studentCode','studentName','periodStart','periodEnd','questions','correct','wrong','accuracy','xpGained','xpTotal','durationSec'].join(','));
    rows.push([
      report.schemaVersion,
      csvSafe(report.classId),
      csvSafe(report.studentCode),
      csvSafe(report.studentName),
      report.periodStart,
      report.periodEnd,
      report.summary.questions,
      report.summary.correct,
      report.summary.wrong,
      report.summary.accuracy,
      report.summary.xpGained,
      report.summary.xpTotal,
      report.summary.durationSec
    ].join(','));

    rows.push('');
    rows.push('Breakdown by operation');
    rows.push('operation,questions,correct,wrong,accuracy');
    for (const op of Object.keys(report.breakdown.byOperation)){
      const b = report.breakdown.byOperation[op];
      rows.push([op,b.questions,b.correct,b.wrong,b.accuracy].join(','));
    }
    rows.push('');
    rows.push('Top mistakes (from saved errors)');
    rows.push('item,count');
    for (const [k,v] of report.topMistakes){
      rows.push([csvSafe(k), v].join(','));
    }
    return rows.join('\n');
  }

  function csvSafe(v){
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  }

  function download(name, mime, content){
    const blob = new Blob([content], {type: mime});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function buildReport(){
    const identity = {
      studentName: String(els.inpName.value || '').trim(),
      studentCode: String(els.inpCode.value || '').trim(),
      classId: String(els.inpClass.value || '').trim(),
      school: String(els.inpSchool.value || '').trim()
    };

    const period = startEndFromPeriod(els.periodSelect.value || 'last7');
    const sessions = loadSessions().filter(s => Number(s?.ts) >= period.start && Number(s?.ts) <= period.end);
    const errors = loadErrors().filter(e => Number(e?.timestamp) >= period.start && Number(e?.timestamp) <= period.end);

    const sum = {
      questions: 0,
      correct: 0,
      wrong: 0,
      xpGained: 0,
      durationSec: 0
    };

    const byOp = {};
    const byTag = {}; // operation => stats
    for (const s of sessions){
      const op = String(s?.operation || 'unknown');
      if (!byOp[op]) byOp[op] = {questions:0, correct:0, wrong:0};
      const q = Number(s?.questions ?? (Number(s?.correct||0)+Number(s?.wrong||0)));
      const c = Number(s?.correct||0);
      const w = Number(s?.wrong||0);
      const xpD = Number(s?.xpDelta||0);
      const dur = Number(s?.durationSec||0);

      byOp[op].questions += q;
      byOp[op].correct += c;
      byOp[op].wrong += w;

      sum.questions += q;
      sum.correct += c;
      sum.wrong += w;
      sum.xpGained += xpD;
      sum.durationSec += dur;
    }

    const accuracy = sum.questions > 0 ? Math.round((sum.correct / sum.questions) * 100) : 0;

    // Top mistakes: use error question string if exists, else operation label
    
    // Breakdown por skillTag (principalmente para intervenção do professor)
    for (const e of errors){
      const op = String(e?.operacao || '').trim();
      const tag = String(e?.skillTag || '').trim() || (op ? ('op:' + op) : 'desconhecido');
      byTag[tag] = (byTag[tag]||0) + 1;
    }
const topMistakes = summarizeTop(errors, (e)=>{
      if (e?.question) return String(e.question);
      if (e?.operation) return `Erro em ${String(e.operation)}`;
      return '';
    }, 5);

    const report = {
      schemaVersion: '1.0',
      createdAt: now(),
      periodStart: period.start,
      periodEnd: period.end,
      classId: identity.classId || identity.school || '',
      school: identity.school,
      studentCode: identity.studentCode,
      studentName: identity.studentName,
      summary: {
        questions: sum.questions,
        correct: sum.correct,
        wrong: sum.wrong,
        accuracy,
        xpGained: sum.xpGained,
        xpTotal: loadXp(),
        durationSec: sum.durationSec
      },
      breakdown: {
        byOperation: Object.fromEntries(Object.entries(byOp).map(([op, b])=>{
          const acc = b.questions > 0 ? Math.round((b.correct/b.questions)*100) : 0;
          return [op, { ...b, accuracy: acc }];
        }))
      },
      topMistakes
    };

    return report;
  }

  function renderReport(report){
    const lines = [];
    lines.push(`<div class="tiny muted">Gerado em: <strong>${escapeHtml(fmtDate(report.createdAt))}</strong></div>`);
    lines.push(`<div style="margin-top:8px;"><span class="pill">Turma</span> ${escapeHtml(report.classId || '-')}&nbsp;&nbsp;<span class="pill">Aluno</span> ${escapeHtml(report.studentCode || report.studentName || '-')}</div>`);
    lines.push(`<div style="margin-top:8px;">Questões: <strong>${report.summary.questions}</strong> · Acertos: <strong>${report.summary.correct}</strong> · Erros: <strong>${report.summary.wrong}</strong> · Precisão: <strong>${report.summary.accuracy}%</strong></div>`);
    lines.push(`<div class="bar" style="margin-top:8px;"><div style="width:${report.summary.accuracy}%;"></div></div>`);
    lines.push(`<div class="tiny muted" style="margin-top:8px;">XP ganho no período: <strong>${report.summary.xpGained}</strong> · XP total: <strong>${report.summary.xpTotal}</strong> · Tempo: <strong>${report.summary.durationSec}s</strong></div>`);

    const ops = Object.keys(report.breakdown.byOperation);
    if (ops.length){
      lines.push('<hr style="margin:14px 0; opacity:.2;">');
      lines.push('<div><strong>Por operação</strong></div>');
      lines.push('<ul style="margin:8px 0 0 18px;">');
      for (const op of ops){
        const b = report.breakdown.byOperation[op];
        lines.push(`<li><strong>${escapeHtml(op)}</strong>: ${b.correct}/${b.questions} (${b.accuracy}%)</li>`);
      }
      lines.push('</ul>');
    }

    if (report.topMistakes && report.topMistakes.length){
      lines.push('<hr style="margin:14px 0; opacity:.2;">');
      lines.push('<div><strong>Erros mais frequentes (salvos)</strong></div>');
      lines.push('<ol style="margin:8px 0 0 18px;">');
      for (const [k,v] of report.topMistakes){
        lines.push(`<li>${escapeHtml(k)} <span class="muted">(${v}x)</span></li>`);
      }
      lines.push('</ol>');
    } else {
      lines.push('<div class="tiny muted" style="margin-top:10px;">Sem erros registrados neste período.</div>');
    }

    setOutput(lines.join(''));
  }

  function makeCode(report){
    const json = JSON.stringify(report);
    return 'MMR1:' + b64EncodeUnicode(json);
  }

  function parseCode(code){
    const raw = String(code||'').trim();
    if (!raw.startsWith('MMR1:')) throw new Error('Código inválido: esperado prefixo MMR1:');
    const b64 = raw.slice(5);
    const json = b64DecodeUnicode(b64);
    const obj = JSON.parse(json);
    if (!obj || obj.schemaVersion !== '1.0') throw new Error('Versão de relatório não suportada.');
    return obj;
  }

  function clearQr(){
    els.qr.innerHTML = '';
  }

  function showQr(code){
    clearQr();
    // QRCode lib (qrcode.min.js) provides global QRCode
    // Keep size reasonable
    // eslint-disable-next-line no-undef
    new QRCode(els.qr, { text: code, width: 256, height: 256, correctLevel: QRCode.CorrectLevel.M });
  }

  function init(){
    // Profile select (single for now)
    if (els.profileSelect){
      els.profileSelect.innerHTML = '<option value="app">Atual (do app)</option>';
    }

    // Load app profile into fields
    function loadIntoFields(){
      const p = readProfile();
      if (!els.inpName.value) els.inpName.value = p.name;
      if (!els.inpClass.value) els.inpClass.value = p.turma;
      if (!els.inpSchool.value) els.inpSchool.value = p.escola;
    }
    loadIntoFields();

    els.btnLoadProfile?.addEventListener('click', ()=>{ loadIntoFields(); });

    els.btnGenerate?.addEventListener('click', ()=>{
      const report = buildReport();
      renderReport(report);
      const code = makeCode(report);
      els.code.value = code;
      clearQr();
    });

    els.btnShowQr?.addEventListener('click', ()=>{
      const code = String(els.code.value||'').trim();
      if (!code) return alert('Gere o relatório primeiro.');
      showQr(code);
    });

    els.btnCopy?.addEventListener('click', async ()=>{
      const code = String(els.code.value||'').trim();
      if (!code) return alert('Nada para copiar.');
      try {
        await navigator.clipboard.writeText(code);
        alert('Código copiado ✅');
      } catch (_) {
        // fallback
        els.code.select();
        document.execCommand('copy');
        alert('Código copiado ✅');
      }
    });

    els.btnJson?.addEventListener('click', ()=>{
      const code = String(els.code.value||'').trim();
      if (!code) return alert('Gere o relatório primeiro.');
      const report = parseCode(code);
      const name = `matemagica_relatorio_${(report.studentCode||report.studentName||'aluno')}_${report.periodStart}_${report.periodEnd}.json`;
      download(name, 'application/json;charset=utf-8', JSON.stringify(report, null, 2));
    });

    els.btnCsv?.addEventListener('click', ()=>{
      const code = String(els.code.value||'').trim();
      if (!code) return alert('Gere o relatório primeiro.');
      const report = parseCode(code);
      const name = `matemagica_relatorio_${(report.studentCode||report.studentName||'aluno')}_${report.periodStart}_${report.periodEnd}.csv`;
      download(name, 'text/csv;charset=utf-8', makeCsv(report));
    });
  }

  init();
})();
