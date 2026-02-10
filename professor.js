/* Painel do Professor — Matemágica (offline)
   - Importa: QR (MMR1), código colado, arquivo JSON
   - Consolida por turma/período localmente
*/
(function(){
  'use strict';

  const DB_KEY = 'matemagica_teacher_db_v1';

  const els = {
    inpCode: document.getElementById('inp-code'),
    btnImport: document.getElementById('btn-import'),
    btnScan: document.getElementById('btn-scan'),
    btnStop: document.getElementById('btn-stop-scan'),
    videoWrap: document.getElementById('video-wrap'),
    video: document.getElementById('qr-video'),
    tblBody: document.getElementById('tbl-body'),
    countText: document.getElementById('count-text'),
    filterClass: document.getElementById('filter-class'),
    filterPeriod: document.getElementById('filter-period'),
    btnExportJson: document.getElementById('btn-export-json'),
    btnExportCsv: document.getElementById('btn-export-csv'),
    btnClear: document.getElementById('btn-clear'),
    btnPaste: document.getElementById('btn-paste'),
    pasteWrap: document.getElementById('paste-wrap'),
    btnImportWeekly: document.getElementById('btn-import-weekly'),
    fileWeekly: document.getElementById('file-weekly'),
    weeklyTblBody: document.getElementById('weekly-tbl-body'),
    weeklyCountText: document.getElementById('weekly-count-text'),
    weeklyClassSummary: document.getElementById('weekly-class-summary'),
    intervList: document.getElementById('interv-list'),
    intervRec: document.getElementById('interv-rec'),
    btnCopyRec: document.getElementById('btn-copy-rec'),
    btnCopyWhats: document.getElementById('btn-copy-whats'),
    classSummary: document.getElementById('class-summary'),
    interventionText: document.getElementById('intervention-text'),
    btnCopyIntervention: document.getElementById('btn-copy-intervention'),
  };

  function safeParse(raw, fallback){
    try { return raw ? JSON.parse(raw) : fallback; } catch(_) { return fallback; }
  }

  function b64DecodeUnicode(str){
    return decodeURIComponent(escape(atob(str)));
  }

  function parseCode(raw){
    const s = String(raw||'').trim();
    if (!s.startsWith('MMR1:')) throw new Error('Código inválido (esperado MMR1:...)');
    const json = b64DecodeUnicode(s.slice(5));
    const obj = JSON.parse(json);
    if (!obj || obj.schemaVersion !== '1.0') throw new Error('Versão de relatório não suportada.');
    return obj;
  }

  function loadDb(){
    const db = safeParse(localStorage.getItem(DB_KEY), { reports: [], weekly: [] });
    if (!db || !Array.isArray(db.reports)) return { reports: [], weekly: [] };
    if (!Array.isArray(db.weekly)) db.weekly = [];
    return db;
  }
  function saveDb(db){
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch(_) {}
  }

  function keyForReport(r){
    return [
      String(r.classId||'').trim(),
      String(r.studentCode||r.studentName||'').trim(),
      String(r.periodStart||''),
      String(r.periodEnd||'')
    ].join('|');
  }

  function upsertReport(newR){
    const db = loadDb();
    const k = keyForReport(newR);
    const idx = db.reports.findIndex(r => keyForReport(r) === k);
    if (idx >= 0){
      // replace (default)
      db.reports[idx] = newR;
    } else {
      db.reports.unshift(newR);
    }
    // limit
    if (db.reports.length > 2000) db.reports.length = 2000;
    saveDb(db);
  }

  // === Weekly summaries (Casa → Escola) ===
  function keyForWeekly(w){
    return [
      String(w.student?.turma||w.student?.classId||'').trim(),
      String(w.student?.code||w.student?.name||'').trim(),
      String(w.windowDays||''),
      String(w.generatedAt||'')
    ].join('|');
  }

  function upsertWeekly(newW){
    const db = loadDb();
    const k = keyForWeekly(newW);
    const idx = db.weekly.findIndex(w => keyForWeekly(w) === k);
    if (idx >= 0) db.weekly[idx] = newW;
    else db.weekly.unshift(newW);
    if (db.weekly.length > 4000) db.weekly.length = 4000;
    saveDb(db);
  }

  function parseWeeklyJson(raw){
    const obj = JSON.parse(String(raw||''));
    if (!obj || obj.schema !== 'PET_WEEKLY_SUMMARY_v1') throw new Error('JSON não é um resumo semanal PET válido.');
    return obj;
  }

  function fmtPeriod(r){
    const s = new Date(r.periodStart).toLocaleDateString('pt-BR');
    const e = new Date(r.periodEnd).toLocaleDateString('pt-BR');
    return `${s} → ${e}`;
  }

  function pct(n){
    return `${Number(n||0)}%`;
  }

  function render(){
    const db = loadDb();
    const cls = String(els.filterClass?.value || '').trim();
    const per = String(els.filterPeriod?.value || '').trim();

    let list = db.reports.slice();

    if (cls){
      list = list.filter(r => String(r.classId||'').trim().toLowerCase() === cls.toLowerCase());
    }
    if (per && per !== 'all'){
      const now = Date.now();
      let start = 0;
      if (per === 'today'){
        const d = new Date(); d.setHours(0,0,0,0);
        start = d.getTime();
      } else if (per === 'last7'){
        start = now - 7*24*3600*1000;
      } else if (per === 'last30'){
        start = now - 30*24*3600*1000;
      }
      list = list.filter(r => Number(r.periodEnd||0) >= start);
    }

    els.countText.textContent = `${list.length} relatórios.`;

    // table
    els.tblBody.innerHTML = '';
    for (const r of list){
      const tr = document.createElement('tr');

      const who = (r.studentCode || r.studentName || '-');
      const perf = `${r.summary.correct}/${r.summary.questions} (${pct(r.summary.accuracy)})`;

      tr.innerHTML = `
        <td><div><strong>${escapeHtml(who)}</strong><div class="muted tiny">${escapeHtml(r.studentName||'')}</div></div></td>
        <td>${escapeHtml(r.classId||'-')}</td>
        <td>${escapeHtml(fmtPeriod(r))}</td>
        <td>
          <div><strong>${escapeHtml(perf)}</strong></div>
          <div class="muted tiny">XP +${escapeHtml(String(r.summary.xpGained||0))} · Tempo ${escapeHtml(String(r.summary.durationSec||0))}s</div>
        </td>
        <td>
          <button class="main-btn tiny-btn" data-action="details">Detalhes</button>
          <button class="main-btn tiny-btn" data-action="remove">Remover</button>
        </td>
      `;
      tr.querySelector('[data-action="details"]').addEventListener('click', ()=>showDetails(r));
      tr.querySelector('[data-action="remove"]').addEventListener('click', ()=>removeReport(r));

      els.tblBody.appendChild(tr);
    }

    renderSummary(list);
    renderWeekly(db.weekly, cls, per);
    refreshClassFilter(db.reports);
  }

  function refreshClassFilter(reports){
    if (!els.filterClass) return;
    const current = els.filterClass.value || '';
    const classes = [...new Set(reports.map(r=>String(r.classId||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    els.filterClass.innerHTML = '<option value="">Todas as turmas</option>' + classes.map(c=>`<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join('');
    if (classes.includes(current)) els.filterClass.value = current;
  }

  
  function opLabel(op){
    const map = {
      'addition':'Adição',
      'subtraction':'Subtração',
      'multiplication':'Multiplicação',
      'division':'Divisão',
      'potenciacao':'Potenciação',
      'radiciacao':'Radiciação'
    };
    return map[op] || op;
  }

  function detectPatternFromMistakes(topMistakes){
    // heurísticas simples: identifica “vai-um”, “empréstimo”, “resto”
    const out = { carry:false, borrow:false, remainder:false, squares:false, roots:false };
    for (const [k] of (topMistakes||[])){
      const s = String(k||'');
      if (s.includes('resto') || /÷/.test(s) && /\(resto\)/.test(s)) out.remainder = true;
      if (/²/.test(s)) out.squares = true;
      if (/√/.test(s)) out.roots = true;
      // pega padrões de 2 dígitos
      const mAdd = s.match(/(\d{2,})\s*\+\s*(\d{2,})/);
      if (mAdd){
        const a = parseInt(mAdd[1],10), b = parseInt(mAdd[2],10);
        if ((a%10)+(b%10) >= 10) out.carry = true;
      }
      const mSub = s.match(/(\d{2,})\s*[−-]\s*(\d{2,})/);
      if (mSub){
        const a = parseInt(mSub[1],10), b = parseInt(mSub[2],10);
        if ((a%10) < (b%10)) out.borrow = true;
      }
    }
    return out;
  }

  function buildInterventionText(list){
    if (!list.length) return {text:'Importe relatórios para gerar uma recomendação automática.', canCopy:false};

    // Agrega erros por operação
    const opMap = new Map();
    const accMap = new Map();
    for (const r of list){
      const byOp = r.breakdown?.byOperation || {};
      for (const op of Object.keys(byOp)){
        const b = byOp[op];
        opMap.set(op, (opMap.get(op)||0) + Number(b.wrong||0));
        const q = Number(b.questions||0);
        const c = Number(b.correct||0);
        const a = q ? (c/q) : 0;
        // guarda a menor acurácia observada
        if (!accMap.has(op)) accMap.set(op, a);
        else accMap.set(op, Math.min(accMap.get(op), a));
      }
    }
    const [topOp, topErr] = [...opMap.entries()].sort((a,b)=>b[1]-a[1])[0] || ['—',0];
    const topAcc = accMap.has(topOp) ? Math.round(accMap.get(topOp)*100) : 0;

    // Pega top mistakes do primeiro relatório (geralmente aluno) — se houver vários, tenta o maior “wrong”
    const best = list.slice().sort((a,b)=>Number(b.summary?.wrong||0)-Number(a.summary?.wrong||0))[0] || list[0];
    const patt = detectPatternFromMistakes(best.topMistakes || []);

    const cls = String(list[0].classId || '').trim() || '—';

    // Sugestão pronta (2 passos)
    const opName = opLabel(topOp);
    let foco = opName;
    let tatico = '';
    if (topOp==='addition' && patt.carry) tatico = 'Foco: reagrupamento (vai-um).';
    if (topOp==='subtraction' && patt.borrow) tatico = 'Foco: empréstimo (dezenas/unidades).';
    if (topOp==='division' && patt.remainder) tatico = 'Foco: quociente x resto (volta na multiplicação).';
    if (topOp==='potenciacao' && patt.squares) tatico = 'Foco: quadrados perfeitos (2²–15²).';
    if (topOp==='radiciacao' && patt.roots) tatico = 'Foco: raízes de quadrados perfeitos.';

    const text = [
      `🎯 Intervenção rápida — Turma ${cls}`,
      `Maior dificuldade: ${opName} (erros: ${topErr}, acurácia aprox.: ${topAcc}%).`,
      tatico || 'Foco: precisão + estratégia (dica curta, sem decorar).',
      '',
      'Em sala (8–10 min):',
      `1) Demonstração guiada (1 exemplo) + “dica sob demanda”.`,
      `2) Campanha: ${opName} (lições curtas de 8–12 questões).`,
      '',
      'Para casa (5 min):',
      `• Missão “Forja do dia” (5 min) focando em ${opName}.`,
      '• Regra: fazer 1 missão/dia por 7 dias (sequência).',
      '',
      'Critério de sucesso:',
      '• Acurácia sobe ≥ +10 p.p. na próxima semana OU erros caem visivelmente no relatório.',
    ].filter(Boolean).join('\n');

    return {text, canCopy:true};
  }

  function renderIntervention(list){
    const r = buildInterventionText(list);
    if (els.interventionText) els.interventionText.textContent = r.text;
    if (els.btnCopyIntervention){
      els.btnCopyIntervention.disabled = !r.canCopy;
      els.btnCopyIntervention.onclick = ()=>{
        try{
          navigator.clipboard.writeText(r.text);
          els.btnCopyIntervention.textContent = 'Copiado ✅';
          setTimeout(()=>els.btnCopyIntervention.textContent = 'Copiar recomendação', 1200);
        }catch(e){
          alert('Não foi possível copiar. Selecione o texto e copie manualmente.');
        }
      };
    }
  }

function renderSummary(list){
    if (!els.classSummary) return;
    if (!list.length){
      els.classSummary.innerHTML = '<h3>Resumo da turma</h3><p class="muted">Importe relatórios para ver métricas.</p>';
      return;
    }

    const total = list.reduce((acc,r)=>{
      acc.questions += Number(r.summary.questions||0);
      acc.correct += Number(r.summary.correct||0);
      acc.wrong += Number(r.summary.wrong||0);
      acc.xp += Number(r.summary.xpGained||0);
      return acc;
    }, {questions:0,correct:0,wrong:0,xp:0});

    const accuracy = total.questions ? Math.round((total.correct/total.questions)*100) : 0;

    // top operations across reports
    const opMap = new Map();
    for (const r of list){
      const byOp = r.breakdown?.byOperation || {};
      for (const op of Object.keys(byOp)){
        const b = byOp[op];
        opMap.set(op, (opMap.get(op)||0) + Number(b.wrong||0));
      }
    }
    const topOps = [...opMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);

    const cls = list[0].classId || '';
    els.classSummary.innerHTML = `
      <h3>Resumo da turma</h3>
      <div class="muted tiny">Turma: <strong>${escapeHtml(cls||'—')}</strong> · Relatórios: <strong>${list.length}</strong></div>
      <div style="margin-top:8px;">Questões: <strong>${total.questions}</strong> · Precisão média: <strong>${accuracy}%</strong> · XP total ganho (períodos): <strong>${total.xp}</strong></div>
      <div class="muted tiny" style="margin-top:10px;"><strong>Dificuldades mais comuns (por operação, baseado em erros)</strong></div>
      <ul style="margin:8px 0 0 18px;">${topOps.length ? topOps.map(([op,c])=>`<li>${escapeHtml(op)} <span class="muted">(${c} erros)</span></li>`).join('') : '<li class="muted">—</li>'}</ul>
    `;
    renderIntervention(list);
  }


  function statusPill(accuracy, activeDays){
    const a = (accuracy==null) ? null : Number(accuracy);
    const d = Number(activeDays||0);
    // Sem drama: critérios práticos
    if (a != null && a >= 80 && d >= 3) return {label:'VERDE', cls:'pill'};
    if (a != null && a >= 70 && d >= 2) return {label:'AMARELO', cls:'pill'};
    return {label:'VERMELHO', cls:'pill'};
  }

  function skillTagHuman(tag){
    const t = String(tag||'').trim();
    const map = {
      'add_le20':'Adição até 20',
      'add_carry_2d':'Adição com vai‑um',
      'add_basic':'Adição (base)',
      'add_mix':'Adição (mista)',
      'sub_le20':'Subtração até 20',
      'sub_borrow_2d':'Subtração com empréstimo',
      'sub_basic':'Subtração (base)',
      'sub_mix':'Subtração (mista)',
      'mult_0_5':'Tabuadas 0–5',
      'mult_6_10':'Tabuadas 6–10',
      'mult_mix':'Multiplicação (mista)',
      'div_exact':'Divisão exata',
      'div_remainder':'Divisão com resto',
      'pow_squares':'Potenciação (quadrados)',
      'root_squares':'Radiciação (quadrados)'
    };
    return map[t] || t || '—';
  }

  function suggestInterventionFromWeekly(w){
    // prioridade: top skillTag + pior operação
    const top = (w.difficulties?.topSkillTags||[])[0]?.tag || '';
    const opEntries = Object.entries(w.performance?.byOperation || {});
    const worstOp = opEntries
      .filter(([,v])=>v && v.questions>0 && v.accuracy!=null)
      .sort((a,b)=>Number(a[1].accuracy)-Number(b[1].accuracy))[0];

    const parts = [];
    parts.push(`Aluno: ${w.student?.name || w.student?.code || '—'} · Turma: ${w.student?.turma || '—'}`);
    parts.push(`Uso (7d): ${w.usage?.activeDays||0} dias · ${w.usage?.totalMinutes||0} min · ${w.usage?.sessions||0} sessões`);
    if (w.performance?.accuracy!=null) parts.push(`Precisão geral (7d): ${w.performance.accuracy}%`);

    const targetSkill = skillTagHuman(top);
    if (top) parts.push(`Maior dificuldade: ${targetSkill}`);

    // ação de 10 minutos (padrão PET)
    const action = [];
    action.push('Ação (10 min):');
    if (top === 'sub_borrow_2d'){
      action.push('1) 3 exemplos no caderno: “troca 1 dezena por 10 unidades” (mostre a troca).');
      action.push('2) 5 questões no app focando “empréstimo” (sem pressa).');
      action.push('3) 1 questão mista no final (para evitar treino mecânico).');
    } else if (top === 'add_carry_2d'){
      action.push('1) 3 exemplos no caderno: completar 10 e mostrar o “vai‑um”.');
      action.push('2) 5 questões no app com vai‑um.');
      action.push('3) 1 questão mista.');
    } else if (top === 'mult_0_5' || top === 'mult_6_10' || top === 'mult_mix'){
      action.push('1) 2 min: grupos iguais/área (desenho rápido).');
      action.push('2) 6–8 questões de tabuada do nível (no app).');
      action.push('3) 1 aplicação curta: “6 caixas com 7”.');
    } else if (top === 'div_remainder' || top === 'div_exact'){
      action.push('1) 2 min: partilha (desenho de grupos).');
      action.push('2) 6 questões de divisão (no app).');
      action.push('3) checagem: “multiplicação inversa” (6×? = 24).');
    } else {
      action.push('1) Identifique o erro recorrente (top 1) e faça 2 exemplos no caderno.');
      action.push('2) Rode 10 questões no app focadas nessa habilidade.');
      action.push('3) Feche com 1 item mista.');
    }

    if (worstOp){
      action.push(`Observação: pior operação na semana = ${opLabel(worstOp[0])} (${worstOp[1].accuracy}% de precisão; ${worstOp[1].questions} questões).`);
    }

    return parts.join('\n') + '\n\n' + action.join('\n');
  }

  function renderWeekly(allWeekly, clsFilter, perFilter){
    if (!els.weeklyTblBody || !els.weeklyCountText || !els.weeklyClassSummary) return;

    const now = Date.now();
    let start = 0;
    if (perFilter === 'today'){
      const d = new Date(); d.setHours(0,0,0,0); start = d.getTime();
    } else if (perFilter === 'last7'){
      start = now - 7*24*3600*1000;
    } else if (perFilter === 'last30'){
      start = now - 30*24*3600*1000;
    }

    let list = Array.isArray(allWeekly) ? allWeekly.slice() : [];
    if (clsFilter){
      list = list.filter(w => String(w.student?.turma||'').trim().toLowerCase() === clsFilter.toLowerCase());
    }
    if (perFilter && perFilter !== 'all'){
      list = list.filter(w => Number(w.generatedAt||0) >= start);
    }

    els.weeklyCountText.textContent = `${list.length} resumos.`;
    els.weeklyTblBody.innerHTML = '';

    // table rows
    for (const w of list){
      const tr = document.createElement('tr');
      const who = (w.student?.code || w.student?.name || '-');
      const turma = w.student?.turma || '-';
      const acc = w.performance?.accuracy;
      const activeDays = w.usage?.activeDays || 0;
      const mins = w.usage?.totalMinutes || 0;
      const topTag = (w.difficulties?.topSkillTags||[])[0]?.tag || '';
      const topTagLabel = topTag ? skillTagHuman(topTag) : '—';
      const pill = statusPill(acc, activeDays);

      tr.innerHTML = `
        <td><div><strong>${escapeHtml(who)}</strong><div class="muted tiny">${escapeHtml(w.student?.name||'')}</div></div></td>
        <td>${escapeHtml(turma)}</td>
        <td>
          <div><span class="${pill.cls}">${pill.label}</span></div>
          <div class="muted tiny">${escapeHtml(String(activeDays))} dias · ${escapeHtml(String(mins))} min · ${escapeHtml(String(w.usage?.sessions||0))} sessões</div>
        </td>
        <td>
          <div><strong>${acc==null ? '—' : escapeHtml(String(acc))+'%'}</strong></div>
          <div class="muted tiny">Perguntas: ${escapeHtml(String(w.usage?.questions||0))} · ${acc==null?'':('~'+escapeHtml(String(w.performance?.byOperation ? '' : '')))}</div>
        </td>
        <td>
          <div><strong>${escapeHtml(topTagLabel)}</strong></div>
          <div class="muted tiny">${topTag ? escapeHtml(topTag) : ''}</div>
        </td>
        <td>
          <button class="main-btn tiny-btn" data-action="wdetails">Ver</button>
          <button class="main-btn tiny-btn" data-action="wcopy">Copiar ação</button>
          <button class="main-btn tiny-btn" data-action="wremove">Remover</button>
        </td>
      `;

      tr.querySelector('[data-action="wdetails"]').addEventListener('click', ()=>{
        const txt = suggestInterventionFromWeekly(w);
        alert(txt);
      });
      tr.querySelector('[data-action="wcopy"]').addEventListener('click', async ()=>{
        const txt = suggestInterventionFromWeekly(w);
        try{
          await navigator.clipboard.writeText(txt);
          alert('Copiado.');
        }catch(_){
          prompt('Copie:', txt);
        }
      });
      tr.querySelector('[data-action="wremove"]').addEventListener('click', ()=>{
        removeWeekly(w);
      });

      els.weeklyTblBody.appendChild(tr);
    }

    renderWeeklySummary(list);
  }

  function removeWeekly(w){
    const db = loadDb();
    const k = keyForWeekly(w);
    db.weekly = db.weekly.filter(x => keyForWeekly(x) !== k);
    saveDb(db);
    render();
  }

  function renderWeeklySummary(list){
    if (!els.weeklyClassSummary) return;
    if (!list.length){
      els.weeklyClassSummary.innerHTML = '<h3>Visão rápida (últimos 7 dias)</h3><p class="muted">Importe resumos semanais (JSON) para ver sinais de estudo em casa e dificuldades.</p>';
      return;
    }

    // Agregações simples
    const totals = list.reduce((acc,w)=>{
      acc.students += 1;
      acc.activeDaysSum += Number(w.usage?.activeDays||0);
      acc.minutesSum += Number(w.usage?.totalMinutes||0);
      if (w.performance?.accuracy != null){
        acc.accCount += 1;
        acc.accSum += Number(w.performance.accuracy||0);
      }
      return acc;
    }, {students:0, activeDaysSum:0, minutesSum:0, accSum:0, accCount:0});

    const avgDays = totals.students ? Math.round((totals.activeDaysSum/totals.students)*10)/10 : 0;
    const avgMin = totals.students ? Math.round((totals.minutesSum/totals.students)*10)/10 : 0;
    const avgAcc = totals.accCount ? Math.round((totals.accSum/totals.accCount)*10)/10 : null;

    // top skill tags
    const tagMap = new Map();
    for (const w of list){
      for (const t of (w.difficulties?.topSkillTags||[])){
        const tag = String(t.tag||'');
        tagMap.set(tag, (tagMap.get(tag)||0) + Number(t.count||0));
      }
    }
    const topTags = [...tagMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);

    // pior operação por acurácia média (quando existir)
    const opAgg = new Map();
    for (const w of list){
      const byOp = w.performance?.byOperation || {};
      for (const op of Object.keys(byOp)){
        const v = byOp[op];
        if (!v || v.accuracy == null) continue;
        const cur = opAgg.get(op) || {sum:0, n:0};
        cur.sum += Number(v.accuracy||0);
        cur.n += 1;
        opAgg.set(op, cur);
      }
    }
    const worstOp = [...opAgg.entries()]
      .map(([op,v])=>[op, v.n ? (v.sum/v.n) : 100])
      .sort((a,b)=>a[1]-b[1])[0];

    const cls = String(list[0].student?.turma||'').trim() || '—';

    const action = [];
    action.push(`Turma ${cls} — Casa → Escola (7d)`);
    action.push(`Média de estudo: ${avgDays} dias/semana · ${avgMin} min/semana`);
    if (avgAcc!=null) action.push(`Precisão média (7d): ${avgAcc}%`);
    if (worstOp) action.push(`Maior dor (operação): ${opLabel(worstOp[0])} (~${Math.round(worstOp[1])}%)`);
    if (topTags.length){
      action.push('Top dificuldades (tags):');
      topTags.slice(0,3).forEach(([tag,c])=>action.push(`- ${skillTagHuman(tag)} (${c})`));
    }
    action.push('');
    action.push('Intervenção sugerida (15 min em sala):');
    if (worstOp){
      action.push(`1) 5 min de explicação concreta em ${opLabel(worstOp[0])} (reta/blocos/área).`);
      action.push('2) 8 min de prática guiada (10 questões) no app focando a habilidade do topo.');
      action.push('3) 2 min: 2 itens mistos no caderno (transferência).');
    } else {
      action.push('1) 5 min: revisão do erro dominante (top tag).');
      action.push('2) 10 min: prática guiada no app.');
    }

    els.weeklyClassSummary.innerHTML = `
      <h3>Visão rápida (últimos 7 dias)</h3>
      <div class="muted tiny">Turma: <strong>${escapeHtml(cls)}</strong> · Resumos: <strong>${list.length}</strong></div>
      <div style="margin-top:8px;">${escapeHtml(action.slice(0,4).join(' · '))}</div>
      <div class="muted tiny" style="margin-top:10px;"><strong>Dificuldades mais comuns</strong></div>
      <ul style="margin:8px 0 0 18px;">${topTags.length ? topTags.map(([tag,c])=>`<li>${escapeHtml(skillTagHuman(tag))} <span class="muted">(${c})</span></li>`).join('') : '<li class="muted">—</li>'}</ul>
      <pre style="white-space:pre-wrap;margin-top:10px;padding:12px;border-radius:16px;background:rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.08);font-size:0.95em;">${escapeHtml(action.join('\n'))}</pre>
    `;
  }
  function showDetails(r){
    const byOp = r.breakdown?.byOperation || {};
    const ops = Object.keys(byOp);
    const mistakes = (r.topMistakes||[]).slice(0,5);

    const html = `
      Aluno: ${r.studentCode||'-'} ${r.studentName? '('+r.studentName+')':''}
      Turma: ${r.classId||'-'}
      Período: ${fmtPeriod(r)}
      Questões: ${r.summary.questions} | Acertos: ${r.summary.correct} | Erros: ${r.summary.wrong} | Precisão: ${r.summary.accuracy}%
      XP ganho: ${r.summary.xpGained} | XP total: ${r.summary.xpTotal} | Tempo: ${r.summary.durationSec}s

      Por operação:
      ${ops.length ? ops.map(op=>`- ${op}: ${byOp[op].correct}/${byOp[op].questions} (${byOp[op].accuracy}%)`).join('\n') : '- —'}

      Erros frequentes:
      ${mistakes.length ? mistakes.map(([k,v])=>`- ${k} (${v}x)`).join('\n') : '- —'}
    `.trim();

    alert(html);
  }

  function removeReport(r){
    const db = loadDb();
    const k = keyForReport(r);
    db.reports = db.reports.filter(x => keyForReport(x) !== k);
    saveDb(db);
    render();
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (m)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }
  function escapeAttr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }

  function importFromTextarea(){
    const raw = String(els.inpCode.value||'').trim();
    if (!raw) return alert('Cole o código MMR1 do relatório OU cole o JSON do resumo semanal.');
    try {
      // 1) MMR1 (código)
      if (raw.startsWith('MMR1:')){
        const r = parseCode(raw);
        upsertReport(r);
      } else {
        // 2) JSON (resumo semanal ou relatório exportado)
        const obj = JSON.parse(raw);
        if (obj && obj.schema === 'PET_WEEKLY_SUMMARY_v1'){
          upsertWeekly(obj);
        } else if (obj && obj.schemaVersion === '1.0'){
          upsertReport(obj);
        } else {
          throw new Error('Formato não reconhecido. Use MMR1:... ou JSON PET_WEEKLY_SUMMARY_v1.');
        }
      }
      els.inpCode.value = '';
      render();
      toast('✅ Importado!');
    } catch (e) {
      alert(String(e.message||e));
    }
  }

  function importFromFile(file){
    const fr = new FileReader();
    fr.onload = ()=>{
      try {
        const obj = JSON.parse(String(fr.result||''));
        if (obj && obj.schema === 'PET_WEEKLY_SUMMARY_v1'){
          upsertWeekly(obj);
        } else if (obj && obj.schemaVersion === '1.0'){
          upsertReport(obj);
        } else {
          throw new Error('Arquivo JSON não reconhecido. Esperado: schemaVersion 1.0 (relatório) ou PET_WEEKLY_SUMMARY_v1 (resumo semanal).');
        }
        render();
        toast('✅ Importado do arquivo!');
      } catch (e) {
        alert(String(e.message||e));
      }
    };
    fr.readAsText(file);
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

  function exportJson(){
    const db = loadDb();
    download('matemagica_painel_professor.json','application/json;charset=utf-8', JSON.stringify(db, null, 2));
  }

  function exportCsv(){
    const db = loadDb();
    const rows = [];
    rows.push('classId,studentCode,studentName,periodStart,periodEnd,questions,correct,wrong,accuracy,xpGained,xpTotal,durationSec');
    for (const r of db.reports){
      rows.push([
        csvSafe(r.classId),
        csvSafe(r.studentCode),
        csvSafe(r.studentName),
        r.periodStart,
        r.periodEnd,
        r.summary.questions,
        r.summary.correct,
        r.summary.wrong,
        r.summary.accuracy,
        r.summary.xpGained,
        r.summary.xpTotal,
        r.summary.durationSec
      ].join(','));
    }
    download('matemagica_painel_professor.csv','text/csv;charset=utf-8', rows.join('\n'));
  }

  function csvSafe(v){
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  }

  function clearDb(){
    if (!confirm('Apagar todos os relatórios importados deste dispositivo?')) return;
    saveDb({reports:[]});
    render();
  }

  
  function copyText(text){
    const t = String(text||'').trim();
    if (!t) return;
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(t).then(()=>toast('Copiado ✅')).catch(()=>fallbackCopy(t));
    } else fallbackCopy(t);
  }
  function fallbackCopy(text){
    try{
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position='fixed'; ta.style.left='-9999px';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('Copiado ✅');
    }catch(e){ alert('Não foi possível copiar automaticamente.'); }
  }
function copyWhats(){
    const db = loadDb();
    if (!db.reports.length) return alert('Importe relatórios primeiro.');
    const cls = els.filterClass?.value || (db.reports[0].classId || '');
    const list = db.reports.filter(r => !els.filterClass?.value || String(r.classId||'').trim().toLowerCase() === String(els.filterClass.value).trim().toLowerCase());

    const total = list.reduce((acc,r)=>{
      acc.questions += Number(r.summary.questions||0);
      acc.correct += Number(r.summary.correct||0);
      acc.wrong += Number(r.summary.wrong||0);
      return acc;
    }, {questions:0,correct:0,wrong:0});
    const accPct = total.questions ? Math.round((total.correct/total.questions)*100) : 0;

    const msg = [
      `📊 Matemágica — Resumo ${cls? 'da turma '+cls : ''}`,
      `Relatórios: ${list.length}`,
      `Questões: ${total.questions} | Precisão média: ${accPct}%`,
      `Top 5 alunos (por precisão):`,
      ...list.slice().sort((a,b)=>Number(b.summary.accuracy||0)-Number(a.summary.accuracy||0)).slice(0,5).map(r=>`- ${(r.studentCode||r.studentName||'-')}: ${r.summary.accuracy}% (${r.summary.correct}/${r.summary.questions})`)
    ].join('\n');

    try {
      navigator.clipboard.writeText(msg);
      toast('✅ Resumo copiado!');
    } catch (_) {
      alert(msg);
    }
  }

  // --- QR Scan (2 toques) ---
  let stream = null;
  let scanning = false;
  let detector = null;

  async function startScan(){
    if (scanning) return;
    if (!navigator.mediaDevices?.getUserMedia){
      alert('Câmera não disponível neste navegador. Use “colar código” ou importar arquivo.');
      return;
    }

    els.videoWrap.style.display = 'flex';
    els.btnScan.disabled = true;
    els.btnStop.disabled = false;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      els.video.srcObject = stream;
      await els.video.play();
      scanning = true;

      if ('BarcodeDetector' in window) {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } else {
        detector = null;
      }

      if (!detector) {
        toast('Sem BarcodeDetector. Use “colar código” (MMR1) ou importar arquivo.');
        return;
      }

      toast('Aponte a câmera para o QR…');
      scanLoop();
    } catch (e) {
      console.error(e);
      alert('Não foi possível abrir a câmera.');
      stopScan();
    }
  }

  async function scanLoop(){
    if (!scanning || !detector) return;
    try {
      const codes = await detector.detect(els.video);
      if (codes && codes.length){
        const raw = codes[0].rawValue || '';
        if (raw.startsWith('MMR1:')) {
          const r = parseCode(raw);
          upsertReport(r);
          render();
          toast(`✅ Importado: ${(r.studentCode||r.studentName||'-')}`);
          // continua escaneando (1 toque para o próximo: só manter a câmera aberta)
          // Evitar import duplicado em loop
          await sleep(900);
        }
      }
    } catch (_) {}
    requestAnimationFrame(scanLoop);
  }

  function sleep(ms){ return new Promise(res=>setTimeout(res, ms)); }

  function stopScan(){
    scanning = false;
    els.btnScan.disabled = false;
    els.btnStop.disabled = true;
    els.videoWrap.style.display = 'none';
    try {
      if (stream){
        for (const t of stream.getTracks()) t.stop();
      }
    } catch (_) {}
    stream = null;
    detector = null;
    try { els.video.srcObject = null; } catch(_) {}
  }

  function toast(text){
    // minimal toast
    const div = document.createElement('div');
    div.textContent = text;
    div.style.position='fixed';
    div.style.left='50%';
    div.style.bottom='18px';
    div.style.transform='translateX(-50%)';
    div.style.padding='10px 12px';
    div.style.background='rgba(0,0,0,0.85)';
    div.style.color='#fff';
    div.style.borderRadius='999px';
    div.style.fontWeight='800';
    div.style.zIndex='9999';
    document.body.appendChild(div);
    setTimeout(()=>div.remove(), 1400);
  }

  function wireDropzone(){
    // allow importing JSON via file input using a hidden input triggered by paste? Instead: simple drag-drop on page
    window.addEventListener('dragover', (e)=>{ e.preventDefault(); });
    window.addEventListener('drop', (e)=>{
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f) importFromFile(f);
    });
  }

  function init(){
    // build class filter options from DB
    render();

    els.btnImport?.addEventListener('click', importFromTextarea);
    els.btnPaste?.addEventListener('click', togglePaste);
    els.btnImportWeekly?.addEventListener('click', ()=>els.fileWeekly?.click());
    els.fileWeekly?.addEventListener('change', ()=>{
      const f = els.fileWeekly.files?.[0];
      if (!f) return;
      importFromFile(f);
      try{ els.fileWeekly.value = ''; }catch(_){}
    });
    els.filterClass?.addEventListener('change', render);
    els.filterPeriod?.addEventListener('change', render);

    els.btnExportJson?.addEventListener('click', exportJson);
    els.btnExportCsv?.addEventListener('click', exportCsv);
    els.btnClear?.addEventListener('click', clearDb);
    els.btnCopyWhats?.addEventListener('click', copyWhats);

    els.btnScan?.addEventListener('click', startScan);
    els.btnStop?.addEventListener('click', stopScan);

    wireDropzone();

    // file import: create hidden input on demand (simple)
    document.addEventListener('keydown', (e)=>{
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o'){
        e.preventDefault();
        openFilePicker();
      }
    });

    // add a click area on summary to import file
    els.classSummary?.addEventListener('dblclick', openFilePicker);
  }

  function openFilePicker(){
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json,.csv,text/csv';
    input.addEventListener('change', ()=>{
      const f = input.files?.[0];
      if (!f) return;
      if (f.name.toLowerCase().endsWith('.json')) {
        importFromFile(f);
      } else {
        alert('CSV import não implementado. Use JSON ou código/QR.');
      }
    });
    input.click();
  }

  init();
})();
  function togglePaste(){
    if (!els.pasteWrap) return;
    const on = els.pasteWrap.style.display !== 'none';
    els.pasteWrap.style.display = on ? 'none' : 'block';
    if (!on && els.inpCode) els.inpCode.focus();
  }

