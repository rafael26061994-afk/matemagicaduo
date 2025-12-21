// --- VARIÁVEIS DE ESTADO GLOBAL E CACHE DE ELEMENTOS ---
const screens = document.querySelectorAll('.screen');
const questionText = document.getElementById('question-text');
const answerOptions = document.querySelectorAll('.answer-option');
const timeBar = document.getElementById('time-bar');
const playerScoreElement = document.getElementById('player-score');
const playerXPElement = document.getElementById('player-xp');
const questionCounter = document.getElementById('question-counter');
const feedbackMessageElement = document.getElementById('feedback-message');
const alertSound = document.getElementById('alert-sound');
const librasAlert = document.getElementById('libras-alert');

// Cache de botões e telas
const operationButtons = document.querySelectorAll('.operation-card');
const btnQuitGame = document.querySelector('.btn-quit-game');
const btnExtendTime = document.getElementById('btn-extend-time');
const btnShowAnswer = document.getElementById('btn-show-answer');
const btnVoltarHome = document.querySelectorAll('.btn-voltar-home');
const toggleVoiceRead = document.getElementById('toggle-voice-read');
const toggleNightMode = document.getElementById('toggle-night-mode');
const toggleLibras = document.getElementById('toggle-libras'); 
const modeRapidoBtn = document.getElementById('mode-rapido');
const modeEstudoBtn = document.getElementById('mode-estudo');
const levelButtons = document.querySelectorAll('.level-btn'); 

// Cache de elementos de erro
const btnTreinarErros = document.getElementById('btn-treinar-erros');
const errorCountMessage = document.getElementById('error-count-message');
const errorListContainer = document.getElementById('error-list-container');
const btnClearErrors = document.getElementById('btn-clear-errors');
const btnStartTraining = document.getElementById('btn-start-training');


// Variavel para síntese de voz (Web Speech API)
const synth = window.speechSynthesis;

// --- ESTADO DO JOGO ---
const gameState = {
    currentScreen: 'home-screen',
    currentOperation: '', 
    currentLevel: '', 
    isGameActive: false,
    score: 0,
    xp: 0,
    questionNumber: 0,
    totalQuestions: 20,
    isVoiceReadActive: false,
    isRapidMode: true,

    // Persistência (por perfil)
    errors: [],                 // erros recentes (treino de erros)
    highScores: [],             // ranking local (top scores)
    srsItems: {},               // mapa SRS (spaced repetition) por item
    sessions: [],               // histórico de sessões (professor)

    // Estado da rodada
    currentQuestion: null,
    sessionStartAt: 0,
    questionShownAt: 0,

    // Multiplicação (Tabuada 0–20)
    multConfig: { mode: 'random', tabuada: null, currentTabuada: null }, // random | tabuada | trail
    multLessonQueue: [],

    timer: null,
    timeLeft: 0, 
    maxTime: 0, 
    acertos: 0,
    erros: 0
};



// --- PERFIS (A/B/C) + STORAGE SEGURO (por perfil) ---
let currentProfileId = 'A'; // A|B|C

function k(key) {
    // chave por perfil
    return `matemagica_${currentProfileId}_${key}`;
}
function gkey(key) {
    // chave global (não por perfil)
    return `matemagica_${key}`;
}

function safeJSONParse(txt, fallback) {
    try { return JSON.parse(txt); } catch { return fallback; }
}
function loadJSON(key, fallback) {
    const raw = localStorage.getItem(key);
    return raw ? safeJSONParse(raw, fallback) : fallback;
}
function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.warn('saveJSON failed', e); }
}

function migrateLegacyStorageToProfileA() {
    // Migra as chaves antigas (sem perfil) para o perfil A (uma única vez)
    const migratedKey = gkey('legacy_migrated_v1');
    if (localStorage.getItem(migratedKey) === '1') return;

    const legacyXP = localStorage.getItem('matemagica_xp');
    const legacyErrors = localStorage.getItem('matemagica_errors');

    // Só migra se existir algo
    if (legacyXP !== null || legacyErrors !== null) {
        // perfil A
        const prevProfile = currentProfileId;
        currentProfileId = 'A';

        if (legacyXP !== null) localStorage.setItem(k('xp_v1'), legacyXP);
        if (legacyErrors !== null) localStorage.setItem(k('errors_v1'), legacyErrors);

        currentProfileId = prevProfile;
    }

    localStorage.setItem(migratedKey, '1');
}

function loadActiveProfile() {
    const saved = localStorage.getItem(gkey('active_profile_v1'));
    if (saved === 'A' || saved === 'B' || saved === 'C') currentProfileId = saved;
}
function setActiveProfile(profileId) {
    if (!['A','B','C'].includes(profileId)) return;
    currentProfileId = profileId;
    localStorage.setItem(gkey('active_profile_v1'), profileId);

    // recarrega dados do perfil e atualiza UI
    carregarXP();
    carregarErros();
    carregarSrsItems();
    carregarSessions();
    carregarRanking();
    ensureDailyMission();
    renderTeacherPanel(); // se painel existir
}

function resetCurrentProfileData() {
    const prefix = `matemagica_${currentProfileId}_`;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) keys.push(key);
    }
    keys.forEach(key => localStorage.removeItem(key));

    // reset estado em memória
    gameState.xp = 0;
    gameState.errors = [];
    gameState.srsItems = {};
    gameState.sessions = [];
    gameState.highScores = [];
    ensureDailyMission(); // recria
    carregarXP();
    carregarErros();
    carregarSrsItems();
    carregarSessions();
    carregarRanking();
    updateErrorTrainingButton();
    showFeedbackMessage(`Perfil ${currentProfileId} resetado.`, 'incentive', 2200);
    renderTeacherPanel();
}

// --- FUNÇÕES UTILITY E ACESSIBILIDADE ---

/** Exibe uma tela e oculta as outras */
function exibirTela(id) {
    screens.forEach(screen => {
        screen.classList.remove('active');
    });
    const targetScreen = document.getElementById(id);
    if (targetScreen) {
        targetScreen.classList.add('active');
        gameState.currentScreen = id;
    }
    // Sempre que voltarmos para a home ou resultados, atualiza o botão de treino
    if (id === 'home-screen' || id === 'result-screen') {
        updateErrorTrainingButton();
    }
}

/** Reproduz o som de alerta */
function playAlertSound() {
    if (alertSound) {
        alertSound.currentTime = 0;
        alertSound.play().catch(e => console.error("Erro ao tocar áudio:", e));
    }
}

/** Função de Text-to-Speech (Leitura de Voz) */
function speak(text) {
    if (!gameState.isVoiceReadActive || !synth) return;
    
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0; 
    
    synth.speak(utterance);
}

/** Exibe mensagens de feedback */
function showFeedbackMessage(message, type, duration = 3000) {
    if (!feedbackMessageElement) return;

    feedbackMessageElement.className = 'feedback-message hidden';
    feedbackMessageElement.classList.add(type);
    feedbackMessageElement.textContent = message;

    setTimeout(() => {
        feedbackMessageElement.classList.remove('hidden');
        feedbackMessageElement.classList.add('show');
    }, 50);

    setTimeout(() => {
        feedbackMessageElement.classList.remove('show');
        setTimeout(() => feedbackMessageElement.classList.add('hidden'), 300);
    }, duration);
}


// --- LÓGICA DE PERSISTÊNCIA (Local Storage) ---

function carregarXP() {
    const v = parseInt(localStorage.getItem(k('xp_v1'))) || 0;
    gameState.xp = v;
    if (playerXPElement) playerXPElement.textContent = `XP: ${gameState.xp}`;
}
function atualizarXP(amount) {
    gameState.xp += amount;
    if (gameState.xp < 0) gameState.xp = 0;
    if (playerXPElement) playerXPElement.textContent = `XP: ${gameState.xp}`;
    localStorage.setItem(k('xp_v1'), String(gameState.xp));
}

/** Carrega os erros do jogador do Local Storage. */
function carregarErros() {
    try {
        const errorsJson = localStorage.getItem(k('errors_v1'));
        if (errorsJson) gameState.errors = JSON.parse(errorsJson);
        else gameState.errors = [];
    } catch (e) {
        console.error("Erro ao carregar erros do localStorage:", e);
        gameState.errors = [];
    }
}

/** Salva os erros atuais no Local Storage. */
function salvarErros() {
    try {
        const errorsToSave = gameState.errors.slice(-50);
        localStorage.setItem(k('errors_v1'), JSON.stringify(errorsToSave));
    } catch (e) {
        console.error("Erro ao salvar erros no localStorage:", e);
    }
}


// --- PERSISTÊNCIA EXTRA (SRS, Sessões, Ranking) ---

function carregarSrsItems() {
    gameState.srsItems = loadJSON(k('srs_items_v1'), {}) || {};
}
function salvarSrsItems() {
    saveJSON(k('srs_items_v1'), gameState.srsItems || {});
}

function carregarSessions() {
    gameState.sessions = loadJSON(k('sessions_v1'), []) || [];
}
function salvarSessions() {
    // limita para não estourar storage
    const sessions = (gameState.sessions || []).slice(-400);
    gameState.sessions = sessions;
    saveJSON(k('sessions_v1'), sessions);
}

function carregarRanking() {
    gameState.highScores = loadJSON(k('ranking_v1'), []) || [];
}
function salvarRanking() {
    const list = (gameState.highScores || []).slice(0, 30);
    gameState.highScores = list;
    saveJSON(k('ranking_v1'), list);
}

// --- HELPERS (datas, percentuais, labels) ---
function localISODate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function addLocalDays(isoDate, deltaDays) {
    const [y, m, d] = isoDate.split('-').map(n => parseInt(n, 10));
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + deltaDays);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}
function pct(x) {
    const v = Math.round((Number(x) || 0) * 100);
    return `${v}%`;
}
function opLabel(op) {
    const map = {
        addition: 'Adição (+)',
        subtraction: 'Subtração (−)',
        multiplication: 'Multiplicação (×)',
        division: 'Divisão (÷)',
        potenciacao: 'Potenciação (aⁿ)',
        radiciacao: 'Radiciação (√)'
    };
    return map[op] || op || '—';
}
function safeDiv(a, b) { return b ? (a / b) : 0; }

// --- SRS (Spaced Repetition) ---
function makeSrsKey(op, num1, num2) {
    const a = Number(num1 ?? 0), b = Number(num2 ?? 0);
    if (op === 'addition' || op === 'multiplication') {
        const x = Math.min(a, b), y = Math.max(a, b);
        return `${op}|${x}|${y}`;
    }
    return `${op}|${a}|${b}`;
}
function ensureSrsItem(q) {
    if (!q) return null;
    const key = q.srsKey || makeSrsKey(q.operacao || q.operacaoOriginal || q.operation || q.operacao, q.num1, q.num2);
    if (!key) return null;

    if (!gameState.srsItems) gameState.srsItems = {};
    const items = gameState.srsItems;

    if (!items[key]) {
        items[key] = {
            key,
            operacao: q.operacao || q.operacaoOriginal || q.operation || q.operacao,
            num1: Number(q.num1 ?? 0),
            num2: Number(q.num2 ?? 0),
            correct: 0,
            wrong: 0,
            lapses: 0,
            lastAt: 0
        };
    }
    return items[key];
}
function updateSrsFromAnswer(q, isCorrect) {
    const item = ensureSrsItem(q);
    if (!item) return;

    item.lastAt = Date.now();
    if (isCorrect) item.correct += 1;
    else { item.wrong += 1; item.lapses += 1; }

    salvarSrsItems();
}
function getWorstItems(itemsMap, n = 3, opFilter = null) {
    const items = Object.values(itemsMap || {}).filter(it => it && it.key);
    const filtered = opFilter ? items.filter(it => it.operacao === opFilter) : items;

    // score: lapses + wrong, penaliza correct
    filtered.sort((a, b) => {
        const sa = (a.lapses * 4) + (a.wrong * 2) - (a.correct * 0.5);
        const sb = (b.lapses * 4) + (b.wrong * 2) - (b.correct * 0.5);
        return sb - sa;
    });
    return filtered.slice(0, n);
}
function describeSrsItem(it) {
    const op = it.operacao || '';
    if (op === 'radiciacao') return `√${it.num1}`;
    if (op === 'potenciacao') return `${it.num1}^${it.num2}`;
    const sym = (op === 'addition') ? '+' : (op === 'subtraction') ? '−' : (op === 'multiplication') ? '×' : (op === 'division') ? '÷' : '?';
    return `${it.num1} ${sym} ${it.num2}`;
}

// --- TABUADA 0–20 (trilha / direta) ---
function tabuadaDeckKey() { return k('tabuada_deck_v1'); }

function loadTabuadaDeck() {
    const d = loadJSON(tabuadaDeckKey(), null);
    if (Array.isArray(d) && d.length) return d;
    return [];
}
function saveTabuadaDeck(deck) {
    saveJSON(tabuadaDeckKey(), deck);
}
function freshTabuadaDeck() {
    const arr = [];
    for (let i = 0; i <= 20; i++) arr.push(i);
    // shuffle
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
function drawNextTabuadaFromDeck() {
    let deck = loadTabuadaDeck();
    if (!deck.length) deck = freshTabuadaDeck();
    const next = deck.shift();
    saveTabuadaDeck(deck);
    return Number(next);
}
function initMultiplicationLessonQueue() {
    const arr = [];
    for (let i = 0; i <= 20; i++) arr.push(i);
    // shuffle
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    gameState.multLessonQueue = arr;
}
function nextMultiplierFromQueue() {
    if (!Array.isArray(gameState.multLessonQueue) || gameState.multLessonQueue.length === 0) {
        initMultiplicationLessonQueue();
    }
    return gameState.multLessonQueue.pop();
}

// --- MISSÃO DIÁRIA (alternada) ---
function dailyMissionKey(){ return k('daily_mission_v1'); }
function dailyMissionMetaKey(){ return k('daily_mission_meta_v1'); }
function dailyMissionStreakKey(){ return k('daily_mission_streak_v1'); }

function loadDailyMission() { return loadJSON(dailyMissionKey(), null); }
function saveDailyMission(m) { saveJSON(dailyMissionKey(), m); }

function loadDailyMissionMeta() {
  return loadJSON(dailyMissionMetaKey(), { cycleIndex: 0, lastDate: '' });
}
function saveDailyMissionMeta(meta) { saveJSON(dailyMissionMetaKey(), meta); }

function loadDailyMissionStreak() {
  return loadJSON(dailyMissionStreakKey(), { streak: 0, best: 0, lastDoneDate: '' });
}
function saveDailyMissionStreak(s) { saveJSON(dailyMissionStreakKey(), s); }

function computeStudentSummary() {
    const sessions = gameState.sessions || [];
    const items = gameState.srsItems || {};

    let totalQ = 0, totalC = 0, totalW = 0;
    const byOp = {};

    for (const s of sessions) {
        const op = s.operation || 'unknown';
        if (!byOp[op]) byOp[op] = { q: 0, c: 0, w: 0 };
        byOp[op].q += (s.questions || 0);
        byOp[op].c += (s.correct || 0);
        byOp[op].w += (s.wrong || 0);

        totalQ += (s.questions || 0);
        totalC += (s.correct || 0);
        totalW += (s.wrong || 0);
    }

    // fallback se não há sessões: usa SRS
    if (!sessions.length) {
        for (const it of Object.values(items)) {
            const op = it.operacao || 'unknown';
            const q = (it.correct || 0) + (it.wrong || 0);
            if (!q) continue;
            if (!byOp[op]) byOp[op] = { q: 0, c: 0, w: 0 };
            byOp[op].q += q;
            byOp[op].c += (it.correct || 0);
            byOp[op].w += (it.wrong || 0);
            totalQ += q; totalC += (it.correct||0); totalW += (it.wrong||0);
        }
    }

    let weakestOp = null;
    let weakestAcc = 2;
    for (const [op, v] of Object.entries(byOp)) {
        const acc = v.q ? (v.c / v.q) : 1;
        if (v.q >= 8 && acc < weakestAcc) { weakestAcc = acc; weakestOp = op; }
    }
    const avgAcc = totalQ ? (totalC / totalQ) : 0;

    // melhores scores
    const bestScore = (gameState.highScores && gameState.highScores[0]) ? gameState.highScores[0].score : 0;

    return { totalQ, totalC, totalW, avgAcc, weakestOp: weakestOp || 'multiplication', bestScore };
}

function ensureDailyMission() {
    const today = localISODate();
    const m = loadDailyMission();
    if (m && m.date === today) return m;

    const fresh = createDailyMissionForToday();
    saveDailyMission(fresh);
    return fresh;
}

function createDailyMissionForToday() {
  const today = localISODate();
  const meta = loadDailyMissionMeta();

  // se mudou o dia, avança o ciclo
  if (meta.lastDate && meta.lastDate !== today) meta.cycleIndex = (meta.cycleIndex + 1) % 3;
  if (!meta.lastDate) meta.lastDate = today;
  meta.lastDate = today;

  const cycle = ['itemStreak', 'speedRun', 'opSession'];
  const type = cycle[meta.cycleIndex] || 'itemStreak';

  const items = gameState.srsItems || {};
  const worst = getWorstItems(items, 1, null);
  const top = worst[0];

  // 1) ITEM DIFÍCIL (SRS)
  if (type === 'itemStreak' && top && top.key) {
    const wrong = top.wrong || 0, lapses = top.lapses || 0;
    const goal = (wrong >= 5 || lapses >= 3) ? 4 : 3;

    saveDailyMissionMeta(meta);
    return {
      date: today,
      type: 'itemStreak',
      targetKey: top.key,
      label: `Missão do dia: ${describeSrsItem(top)} — acertar ${goal} seguidas`,
      goal,
      progress: 0,
      done: false
    };
  }

  // 2) VELOCIDADE (tempo médio por questão)
  if (type === 'speedRun') {
    const acc = Number((computeStudentSummary().avgAcc) || 0);
    const goalQ = acc < 0.60 ? 8 : 10;
    const maxAvgSec = acc < 0.60 ? 16 : (acc < 0.80 ? 14 : 12);
    const minAccuracy = acc < 0.60 ? 0.60 : 0.70;

    saveDailyMissionMeta(meta);
    return {
      date: today,
      type: 'speedRun',
      label: `Missão do dia: ⚡ Velocidade — ${goalQ} questões, tempo médio ≤ ${maxAvgSec}s e acerto ≥ ${Math.round(minAccuracy*100)}%`,
      goalQ,
      maxAvgSec,
      minAccuracy,
      count: 0,
      correctCount: 0,
      totalTimeSec: 0,
      done: false
    };
  }

  // 3) SESSÃO DE OPERAÇÃO (foco na mais fraca)
  if (type === 'opSession') {
    const s = computeStudentSummary();
    const op = s?.weakestOp || 'multiplication';
    const acc = Number(s?.avgAcc || 0);

    const goalQ = acc < 0.60 ? 8 : 10;
    const minAccuracy = acc < 0.60 ? 0.70 : 0.80;

    saveDailyMissionMeta(meta);
    return {
      date: today,
      type: 'opSession',
      operation: op,
      label: `Missão do dia: 🧩 ${opLabel(op)} — ${goalQ} questões com acerto ≥ ${Math.round(minAccuracy*100)}%`,
      goalQ,
      minAccuracy,
      count: 0,
      correctCount: 0,
      done: false
    };
  }

  saveDailyMissionMeta(meta);
  return {
    date: today,
    type: 'correctStreak',
    label: 'Missão do dia: acertar 5 seguidas (qualquer operação)',
    goal: 5,
    progress: 0,
    done: false
  };
}

function updateDailyMissionProgress(isCorrect, q, elapsedQSec) {
  const m = ensureDailyMission();
  if (!m || m.done) return;

  if (m.type === 'correctStreak') {
    m.progress = isCorrect ? (m.progress + 1) : 0;
    if (m.progress >= m.goal) m.done = true;
  }

  if (m.type === 'itemStreak') {
    const key = q?.srsKey || makeSrsKey(q?.operacao, q?.num1, q?.num2);
    if (key === m.targetKey) {
      m.progress = isCorrect ? (m.progress + 1) : 0;
      if (m.progress >= m.goal) m.done = true;
    }
  }

  if (m.type === 'speedRun') {
    m.count += 1;
    if (isCorrect) m.correctCount += 1;
    m.totalTimeSec += Math.max(0, Number(elapsedQSec || 0));

    if (m.count >= m.goalQ) {
      const acc = m.correctCount / m.count;
      const avgSec = m.totalTimeSec / m.count;
      m.done = (acc >= m.minAccuracy) && (avgSec <= m.maxAvgSec);
      if (!m.done) { m.count = 0; m.correctCount = 0; m.totalTimeSec = 0; }
    }
  }

  if (m.type === 'opSession') {
    if ((q?.operacao || '') === m.operation) {
      m.count += 1;
      if (isCorrect) m.correctCount += 1;

      if (m.count >= m.goalQ) {
        const acc = m.correctCount / m.count;
        m.done = (acc >= m.minAccuracy);
        if (!m.done) { m.count = 0; m.correctCount = 0; }
      }
    }
  }

  if (m.done) {
    const today = localISODate();
    const s = loadDailyMissionStreak();
    const yesterday = addLocalDays(today, -1);

    s.streak = (s.lastDoneDate === yesterday) ? (s.streak + 1) : 1;
    s.best = Math.max(s.best || 0, s.streak);
    s.lastDoneDate = today;

    saveDailyMissionStreak(s);
    showFeedbackMessage(`🏅 Missão concluída! Sequência: ${s.streak} dia(s)`, 'incentive', 2800);
  }

  saveDailyMission(m);
  renderDailyMissionBox();
}

function resetDailyMissionProgress() {
  const m = ensureDailyMission();
  if (!m) return null;

  m.done = false;
  if (m.type === 'itemStreak' || m.type === 'correctStreak') m.progress = 0;
  if (m.type === 'speedRun') { m.count = 0; m.correctCount = 0; m.totalTimeSec = 0; }
  if (m.type === 'opSession') { m.count = 0; m.correctCount = 0; }

  saveDailyMission(m);
  return m;
}

function forceNewDailyMissionToday(type = 'auto') {
  const today = localISODate();
  const meta = loadDailyMissionMeta();
  meta.lastDate = today;

  if (type === 'auto') {
    meta.cycleIndex = (Number(meta.cycleIndex || 0) + 1) % 3;
  } else {
    const map = { itemStreak: 0, speedRun: 1, opSession: 2 };
    if (type in map) meta.cycleIndex = map[type];
  }
  saveDailyMissionMeta(meta);

  let newMission;
  if (type === 'correctStreak') {
    newMission = { date: today, type: 'correctStreak', label: 'Missão do dia: acertar 5 seguidas (qualquer operação)', goal: 5, progress: 0, done: false };
  } else {
    newMission = createDailyMissionForToday();
  }
  saveDailyMission(newMission);
  return newMission;
}

// --- Painel do Professor (injeção via JS, sem mexer no index.html) ---
function setupTeacherUI() {
    if (document.getElementById('teacher-fab')) return;

    const fab = document.createElement('button');
    fab.id = 'teacher-fab';
    fab.type = 'button';
    fab.title = 'Painel do Professor';
    fab.innerHTML = '👨‍🏫';
    document.body.appendChild(fab);

    const overlay = document.createElement('div');
    overlay.id = 'teacher-overlay';
    overlay.className = 'teacher-overlay hidden';
    overlay.innerHTML = `
      <div class="teacher-panel">
        <div class="teacher-head">
          <div class="teacher-title">👨‍🏫 Painel do Professor</div>
          <button id="teacher-close" class="teacher-close" type="button">✕</button>
        </div>

        <div class="teacher-row">
          <div class="teacher-chip">Perfil:</div>
          <div class="teacher-profile">
            <button class="teacher-pill" data-profile="A" type="button">A</button>
            <button class="teacher-pill" data-profile="B" type="button">B</button>
            <button class="teacher-pill" data-profile="C" type="button">C</button>
          </div>

          <button id="btn-export-data" class="teacher-mini" type="button">📦 Exportar JSON</button>
          <button id="btn-reset-profile" class="teacher-mini danger" type="button">🧹 Reset perfil</button>
        </div>

        <div id="teacher-summary" class="teacher-card"></div>

        <div id="teacher-daily-mission-box" class="teacher-card"></div>

        <div class="teacher-card">
          <div class="teacher-subtitle">Controles da Missão (professor)</div>
          <div class="teacher-row" style="margin-top:8px;gap:10px;flex-wrap:wrap;">
            <select id="sel-daily-mission-type" class="teacher-select">
              <option value="auto">Auto (próxima do ciclo)</option>
              <option value="itemStreak">🎯 Item difícil (SRS)</option>
              <option value="speedRun">⚡ Velocidade</option>
              <option value="opSession">🧩 Sessão por operação</option>
              <option value="correctStreak">✅ Sequência geral</option>
            </select>
            <button id="btn-refresh-daily-mission" class="teacher-mini" type="button">🔄 Trocar missão</button>
            <button id="btn-reset-daily-mission" class="teacher-mini danger" type="button">🧯 Reset progresso</button>
          </div>
          <div class="teacher-hint">Dica: use “Trocar missão” para testar em sala. “Reset” zera só o progresso.</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // eventos
    fab.addEventListener('click', () => openTeacherPanel());
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeTeacherPanel();
    });
    document.getElementById('teacher-close')?.addEventListener('click', closeTeacherPanel);

    overlay.querySelectorAll('.teacher-pill').forEach(btn => {
        btn.addEventListener('click', () => setActiveProfile(btn.getAttribute('data-profile')));
    });

    document.getElementById('btn-reset-profile')?.addEventListener('click', () => {
        const typed = prompt(`Digite RESET para limpar todos os dados do perfil ${currentProfileId}.`);
        if (typed !== 'RESET') return;
        resetCurrentProfileData();
    });

    document.getElementById('btn-export-data')?.addEventListener('click', exportProfileDataJSON);

    document.getElementById('btn-refresh-daily-mission')?.addEventListener('click', () => {
        const sel = document.getElementById('sel-daily-mission-type');
        const type = sel ? sel.value : 'auto';
        forceNewDailyMissionToday(type);
        showFeedbackMessage('🔄 Missão de hoje atualizada (modo professor).', 'incentive', 2200);
        renderDailyMissionBox();
    });

    document.getElementById('btn-reset-daily-mission')?.addEventListener('click', () => {
        const typed = prompt('Digite RESET para zerar o progresso da missão de hoje.');
        if (typed !== 'RESET') return;
        resetDailyMissionProgress();
        showFeedbackMessage('🧯 Missão resetada (progresso zerado).', 'info', 2000);
        renderDailyMissionBox();
    });
}

function openTeacherPanel() {
    const overlay = document.getElementById('teacher-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    renderTeacherPanel();
}
function closeTeacherPanel() {
    const overlay = document.getElementById('teacher-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
}

function exportProfileDataJSON() {
    const payload = {
        exportedAt: new Date().toISOString(),
        profile: currentProfileId,
        xp: gameState.xp,
        errors: gameState.errors || [],
        srsItems: gameState.srsItems || {},
        sessions: gameState.sessions || [],
        ranking: gameState.highScores || [],
        dailyMission: loadDailyMission(),
        dailyMissionMeta: loadDailyMissionMeta(),
        dailyMissionStreak: loadDailyMissionStreak(),
        tabuadaDeck: loadTabuadaDeck()
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `matemagica_perfil_${currentProfileId}_${localISODate()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderTeacherPanel() {
    const overlay = document.getElementById('teacher-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;

    // destaque do perfil ativo
    overlay.querySelectorAll('.teacher-pill').forEach(btn => {
        const p = btn.getAttribute('data-profile');
        btn.classList.toggle('active', p === currentProfileId);
    });

    const s = computeStudentSummary();
    const worst = getWorstItems(gameState.srsItems || {}, 3, null);

    const summaryEl = document.getElementById('teacher-summary');
    if (summaryEl) {
        summaryEl.innerHTML = `
          <div class="teacher-subtitle">Resumo do aluno (Perfil ${currentProfileId})</div>
          <div class="teacher-grid">
            <div><b>XP</b><div>${gameState.xp}</div></div>
            <div><b>Questões</b><div>${s.totalQ}</div></div>
            <div><b>Acerto médio</b><div>${pct(s.avgAcc)}</div></div>
            <div><b>Melhor score</b><div>${s.bestScore || 0}</div></div>
          </div>
          <div class="teacher-subtitle" style="margin-top:12px;">Top 3 itens que mais precisam de treino</div>
          <ol class="teacher-list">
            ${worst.length ? worst.map(it => `<li>${describeSrsItem(it)} <span class="teacher-muted">(erros: ${it.wrong||0}, lapses: ${it.lapses||0})</span></li>`).join('') : '<li class="teacher-muted">Ainda sem dados suficientes. Jogue mais 1–2 partidas.</li>'}
          </ol>
        `;
    }

    renderDailyMissionBox();
}

// Caixa detalhada da missão diária (no painel do professor)
function missionTypeLabel(type) {
  const map = {
    itemStreak: '🎯 Item difícil (SRS)',
    speedRun: '⚡ Velocidade',
    opSession: '🧩 Sessão por operação',
    correctStreak: '✅ Sequência geral'
  };
  return map[type] || type || '—';
}
function missionCycleNextLabel() {
  const meta = loadDailyMissionMeta();
  const cycle = ['itemStreak', 'speedRun', 'opSession'];
  const idx = Number(meta?.cycleIndex || 0);
  const todayType = cycle[idx % 3] || 'itemStreak';
  const nextType = cycle[(idx + 1) % 3] || 'speedRun';
  return { today: missionTypeLabel(todayType), tomorrow: missionTypeLabel(nextType) };
}

function renderDailyMissionBox() {
  const box = document.getElementById('teacher-daily-mission-box');
  if (!box) return;

  const m = ensureDailyMission();
  const streak = loadDailyMissionStreak();
  const cycleInfo = missionCycleNextLabel();

  const progressRatio =
    (m?.type === 'speedRun') ? safeDiv(m.count || 0, m.goalQ || 0) :
    (m?.type === 'opSession') ? safeDiv(m.count || 0, m.goalQ || 0) :
    safeDiv(m.progress || 0, m.goal || 0);

  const pctProg = Math.min(100, Math.round(progressRatio * 100));

  let detailsHtml = '';

  if (m.type === 'itemStreak') {
    detailsHtml = `
      <div class="teacher-muted" style="margin-top:8px;">
        <b>Tipo:</b> ${missionTypeLabel(m.type)}<br/>
        <b>Progresso:</b> ${m.progress || 0}/${m.goal || 0}<br/>
        <b>Item-alvo:</b> ${m.targetKey || '—'}
      </div>
      <div class="teacher-hint">Regra: zera o progresso se errar o item-alvo.</div>
    `;
  }

  if (m.type === 'speedRun') {
    const accNow = safeDiv(m.correctCount || 0, m.count || 0);
    const avgSecNow = (m.count || 0) ? safeDiv(m.totalTimeSec || 0, m.count || 0) : 0;

    detailsHtml = `
      <div class="teacher-muted" style="margin-top:8px;">
        <b>Tipo:</b> ${missionTypeLabel(m.type)}<br/>
        <b>Progresso:</b> ${m.count || 0}/${m.goalQ || 0}<br/>
        <b>Acerto atual:</b> ${pct(accNow)} (mín: ${Math.round((m.minAccuracy || 0)*100)}%)<br/>
        <b>Tempo médio:</b> ${Math.round(avgSecNow)}s (meta: ≤ ${m.maxAvgSec || 0}s)
      </div>
      <div class="teacher-hint">Regra: ao completar ${m.goalQ || 0} questões, precisa bater acerto e tempo. Se falhar, reinicia.</div>
    `;
  }

  if (m.type === 'opSession') {
    const accNow = safeDiv(m.correctCount || 0, m.count || 0);

    detailsHtml = `
      <div class="teacher-muted" style="margin-top:8px;">
        <b>Tipo:</b> ${missionTypeLabel(m.type)}<br/>
        <b>Operação:</b> ${opLabel(m.operation)}<br/>
        <b>Progresso:</b> ${m.count || 0}/${m.goalQ || 0}<br/>
        <b>Acerto atual:</b> ${pct(accNow)} (mín: ${Math.round((m.minAccuracy || 0)*100)}%)
      </div>
      <div class="teacher-hint">Regra: só conta questões dessa operação. Se falhar, reinicia.</div>
    `;
  }

  if (m.type === 'correctStreak') {
    detailsHtml = `
      <div class="teacher-muted" style="margin-top:8px;">
        <b>Tipo:</b> ${missionTypeLabel(m.type)}<br/>
        <b>Progresso:</b> ${m.progress || 0}/${m.goal || 0}
      </div>
      <div class="teacher-hint">Regra: zera a sequência ao errar.</div>
    `;
  }

  const seal = (streak.streak >= 7) ? '🏆 SELO 7 DIAS ATIVO' : `Meta do selo: ${streak.streak}/7 dias`;

  box.innerHTML = `
    <div class="teacher-subtitle">🎯 Missão diária</div>
    <div style="margin-top:6px;"><b>Status:</b> ${m.done ? '✅ Concluída' : 'Em progresso'}</div>
    <div style="margin-top:6px;">${m.label}</div>

    <div class="teacher-progress">
      <div class="teacher-progress-bar" style="width:${pctProg}%;"></div>
    </div>

    ${detailsHtml}

    <div class="teacher-card-inner">
      <div style="font-weight:900;">${seal}</div>
      <div class="teacher-muted" style="margin-top:4px;">
        Melhor sequência: ${streak.best || 0} dia(s) • Último dia concluído: ${streak.lastDoneDate || '—'}
      </div>
    </div>

    <div class="teacher-muted" style="margin-top:10px;">
      🔁 Ciclo: <b>hoje</b> ${cycleInfo.today} • <b>amanhã</b> ${cycleInfo.tomorrow}
    </div>
  `;
}

// --- Modal de Tabuada (sem alterar o layout do index.html) ---
function openMultiplicationModeModal(onDone) {
    // remove modal anterior, se existir
    document.getElementById('mmodal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'mmodal';
    modal.className = 'mmodal';
    modal.innerHTML = `
      <div class="mmodal-card">
        <div class="mmodal-title">Multiplicação (×)</div>
        <div class="mmodal-sub">Escolha como praticar:</div>

        <div class="mmodal-actions">
          <button id="mmodal-trail" class="mmodal-btn" type="button">🛤️ Trilha automática (Tabuadas 0–20)</button>
          <button id="mmodal-direct" class="mmodal-btn" type="button">🎯 Escolher tabuada</button>
          <button id="mmodal-random" class="mmodal-btn ghost" type="button">🎲 Aleatório (modo antigo)</button>
        </div>

        <div id="mmodal-pick" class="mmodal-pick hidden">
          <div class="mmodal-sub">Qual tabuada você quer treinar?</div>
          <div class="mmodal-grid">
            ${Array.from({length:21}, (_,i)=>`<button class="mmodal-pill" data-tab="${i}" type="button">${i}</button>`).join('')}
          </div>
        </div>

        <button id="mmodal-close" class="mmodal-close" type="button">Cancelar</button>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => { modal.remove(); };

    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('#mmodal-close')?.addEventListener('click', close);

    modal.querySelector('#mmodal-random')?.addEventListener('click', () => {
        close();
        onDone?.({ mode: 'random', tabuada: null });
    });

    modal.querySelector('#mmodal-trail')?.addEventListener('click', () => {
        close();
        onDone?.({ mode: 'trail', tabuada: null });
    });

    modal.querySelector('#mmodal-direct')?.addEventListener('click', () => {
        modal.querySelector('#mmodal-pick')?.classList.remove('hidden');
    });

    modal.querySelectorAll('.mmodal-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            const t = Number(btn.getAttribute('data-tab'));
            close();
            onDone?.({ mode: 'tabuada', tabuada: t });
        });
    });
}



/** Atualiza a interface (botão e lista) de treinamento de erros. */
function updateErrorTrainingButton() {
    const errorCount = gameState.errors.length;
    const hasErrors = errorCount > 0;
    
    // Na tela de resultados, mostra o botão para treinar erros se houver erros
    if (btnTreinarErros) {
        btnTreinarErros.style.display = hasErrors ? 'inline-block' : 'none';
    }
    
    // Na tela de Treinamento de Erros, atualiza a mensagem e botões
    if (errorCountMessage) {
        errorCountMessage.textContent = hasErrors 
            ? `Você tem ${errorCount} erro(s) salvo(s) para treinar.`
            : 'Nenhum erro salvo ainda. Comece a jogar para identificarmos seus pontos fracos!';
    }
    
    if (btnStartTraining) {
        btnStartTraining.disabled = !hasErrors;
        btnStartTraining.textContent = hasErrors 
            ? `Começar Treinamento com ${errorCount} Erros`
            : 'Começar Treinamento';
    }
    
    if (btnClearErrors) {
        btnClearErrors.disabled = !hasErrors;
    }

    if (errorListContainer) {
        displayErrorList();
    }
}

/** Exibe a lista dos últimos erros na tela de treinamento. */
function displayErrorList() {
    if (!errorListContainer) return;

    errorListContainer.innerHTML = '';
    
    // Mostra apenas os 10 últimos erros (mais recentes)
    const errorsToShow = gameState.errors.slice(-10).reverse();

    if (errorsToShow.length === 0) {
        errorListContainer.innerHTML = '<p class="incentive-message" style="text-align: center;">Jogue o Modo Rápido e erre para ver seus erros aqui!</p>';
        return;
    }

    errorsToShow.forEach(error => {
        const item = document.createElement('div');
        item.classList.add('error-item');
        
        // Formata a data (opcional, para ser mais legível)
        const date = new Date(error.timestamp).toLocaleDateString('pt-BR');
        
        item.innerHTML = `
            <div>
                <strong>Questão: ${error.question}</strong>
                <p>Sua Resposta: <span class="wrong-answer">${error.userAnswer}</span></p>
                <p>Resposta Correta: <span class="correct-answer">${error.correctAnswer}</span></p>
            </div>
            <p style="font-size: 0.8em; color: var(--cor-texto-principal); opacity: 0.7;">
                ${error.operation.toUpperCase()} | Errado em: ${date}
            </p>
        `;
        errorListContainer.appendChild(item);
    });
}


// --- LÓGICA DO JOGO: GERAÇÃO DE QUESTÕES ---

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Gera uma questão matemática baseada na operação e nível de dificuldade.
 * @param {string} operation - A operação matemática.
 * @returns {object} { question: string, answer: number, options: number[] }
 */
function generateQuestion(operation) {
    let num1, num2, answer, questionString;
    
    // Define o fator de dificuldade baseado no nível
    let diffFactor;
    switch (gameState.currentLevel) {
        case 'easy':
            diffFactor = 1;
            break;
        case 'medium':
            diffFactor = 2;
            break;
        case 'advanced':
            diffFactor = 3;
            break;
        default:
            diffFactor = 1;
    } 

    switch (operation) {
        case 'addition':
            // Números maiores com o aumento do diffFactor
            num1 = randomInt(10 * diffFactor, 50 * diffFactor); 
            num2 = randomInt(5 * diffFactor, 25 * diffFactor);
            answer = num1 + num2;
            questionString = `${num1} + ${num2}`;
            break;
        case 'subtraction':
            num1 = randomInt(20 * diffFactor, 80 * diffFactor);
            num2 = randomInt(5 * diffFactor, num1 - (10 * diffFactor));
            answer = num1 - num2;
            questionString = `${num1} - ${num2}`;
            break;
        case 'multiplication':
            // Tabuada 0–20 (direta ou trilha)
            if (gameState.multConfig && (gameState.multConfig.mode === 'tabuada' || gameState.multConfig.mode === 'trail')) {
                const tab = Number(gameState.multConfig.currentTabuada ?? gameState.multConfig.tabuada ?? 0);
                num1 = tab;
                num2 = nextMultiplierFromQueue(); // 0..20 (embaralhado, sem repetição)
                answer = num1 * num2;
                questionString = `${num1} x ${num2}`;
                break;
            }
            // Modo antigo (aleatório por faixa)
            num1 = randomInt(2, diffFactor < 3 ? 12 : 25); 
            num2 = randomInt(2, diffFactor < 3 ? 10 : 15);
            answer = num1 * num2;
            questionString = `${num1} x ${num2}`;
            break;
        case 'division':
            let divisor = randomInt(2, diffFactor < 3 ? 8 : 12);
            let quotient = randomInt(2, diffFactor < 3 ? 10 : 20);
            num1 = divisor * quotient;
            num2 = divisor;
            answer = quotient;
            questionString = `${num1} ÷ ${num2}`;
            break;
        case 'potenciacao':
            // Potências maiores no nível avançado
            num1 = randomInt(2, diffFactor < 3 ? 5 : 8); 
            num2 = randomInt(2, diffFactor < 3 ? 4 : 5);
            answer = Math.pow(num1, num2);
            questionString = `${num1}ⁿ (${num2})`;
            break;
        case 'radiciacao':
            // Raízes quadradas maiores no nível avançado
            answer = randomInt(2, diffFactor < 3 ? 12 : 15);
            num1 = answer * answer;
            questionString = `√${num1}`;
            break;
        default:
            return { question: "Erro", answer: 0, options: [0, 1, 2, 3] };
    }

    // Gera as opções de resposta
    const options = [answer];
    while (options.length < 4) {
        let diffFactorOptions = Math.max(1, Math.round(Math.abs(answer) * 0.1));
        let incorrect = answer + randomInt(-5 * diffFactorOptions, 5 * diffFactorOptions);
        
        if (incorrect >= 0 && !options.includes(incorrect) && incorrect !== answer) {
            options.push(incorrect);
        }
    }

    // Embaralha as opções
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }

    return { 
        question: questionString + ' = ?', 
        answer: answer, 
        options: options,
        srsKey: makeSrsKey(operation, num1, num2),
        // Informação extra para salvar erro
        operacao: operation,
        num1: num1,
        num2: num2
    };
}


// --- LÓGICA DE CONTROLE DE FLUXO E ESTADO DE JOGO ---

/**
 * Inicia o jogo após a seleção da operação e do nível.
 * @param {string} operation - A operação selecionada.
 * @param {string} level - O nível selecionado ('easy', 'medium', 'advanced').
 */
function startGame(operation, level) {
    if (!operation || !level) {
        showFeedbackMessage("Erro: Operação ou Nível não selecionados!", 'error');
        exibirTela('home-screen');
        return;
    }

    // 1. Resetar o estado do jogo
    gameState.currentOperation = operation;
    gameState.currentLevel = level; 
    gameState.isGameActive = true;
    gameState.score = 0;
    gameState.questionNumber = 0;
    gameState.acertos = 0;
    gameState.erros = 0;


// 1.1. Marcação de tempo da sessão (para histórico do professor)
gameState.sessionStartAt = Date.now();
gameState.questionShownAt = 0;

// 1.2. Configuração especial de Tabuada (0–20)
gameState.multLessonQueue = [];
if (operation === 'multiplication') {
    if (gameState.multConfig?.mode === 'trail') {
        gameState.multConfig.currentTabuada = drawNextTabuadaFromDeck();
        initMultiplicationLessonQueue();
        showFeedbackMessage(`🛤️ Trilha automática: Tabuada do ${gameState.multConfig.currentTabuada}`, 'info', 2600);
        speak(`Trilha automática. Tabuada do ${gameState.multConfig.currentTabuada}.`);
    } else if (gameState.multConfig?.mode === 'tabuada') {
        gameState.multConfig.currentTabuada = Number(gameState.multConfig.tabuada ?? 0);
        initMultiplicationLessonQueue();
        showFeedbackMessage(`🎯 Tabuada do ${gameState.multConfig.currentTabuada}`, 'info', 2200);
        speak(`Tabuada do ${gameState.multConfig.currentTabuada}.`);
    } else {
        gameState.multConfig.currentTabuada = null;
    }
} else {
    // se sair da multiplicação, volta para o comportamento padrão
    gameState.multConfig = { mode: 'random', tabuada: null, currentTabuada: null };
}

    
    gameState.totalQuestions = gameState.isRapidMode ? 20 : Infinity;

    // 2. Configura o tempo máximo baseado no nível e acessibilidade
    let baseTime;
    switch (level) {
        case 'easy':
            baseTime = 150; // 15s (10 ticks/s)
            break;
        case 'medium':
            baseTime = 300; // 30s
            break;
        case 'advanced':
            baseTime = 450; // 45s
            break;
        default:
            baseTime = 300;
    }

    // Regra de Acessibilidade: Dobra o tempo se o Modo Rápido estiver ativo E Acessibilidade (Voz ou Libras) estiver ativa
    const isLibrasActive = document.body.classList.contains('libras-mode');
    const isAccessibilityActive = gameState.isVoiceReadActive || isLibrasActive;
    
    // Atualiza o tempo máximo. Se não for Modo Rápido, o tempo é infinito
    if (gameState.isRapidMode) {
        gameState.maxTime = isAccessibilityActive ? baseTime * 2 : baseTime;
    } else {
        gameState.maxTime = Infinity;
    }
    
    gameState.timeLeft = gameState.maxTime;


    // 3. Atualizar UI do Game Header
    playerScoreElement.textContent = `0 Pontos`;
    
    // 4. Configurações de UI para Modo Estudo vs Rápido
    const timeContainer = timeBar.parentElement;
    if (!gameState.isRapidMode) {
        timeContainer.style.display = 'none';
        btnExtendTime.style.display = 'none';
        btnShowAnswer.style.display = 'block'; // Ajuda é foco no modo Estudo
    } else {
        timeContainer.style.display = 'block';
        btnExtendTime.style.display = 'block';
        btnShowAnswer.style.display = 'block';
        timeBar.style.width = '100%';
        timeBar.style.backgroundColor = 'var(--cor-sucesso)';
    }

    // 5. Iniciar o ciclo de perguntas
    nextQuestion();
    
    // 6. Iniciar o Timer (Se for Modo Rápido)
    if (gameState.isRapidMode) {
        startTimer();
    }

    // 7. Mudar para a tela de jogo
    exibirTela('game-screen');
}


function nextQuestion() {
    // Fim de jogo no Modo Rápido
    if (gameState.isRapidMode && gameState.questionNumber >= gameState.totalQuestions) {
        endGame();
        return;
    }
    
    gameState.questionNumber++;
    
    // 1. Gerar nova questão 
    const newQ = generateQuestion(gameState.currentOperation);
    gameState.currentQuestion = newQ;
    
    // 2. Atualizar UI
    const totalDisplay = gameState.isRapidMode ? gameState.totalQuestions : '∞';
    questionCounter.textContent = `Questão: ${gameState.questionNumber}/${totalDisplay}`;
    questionText.textContent = newQ.question;
    
    // 3. Atualizar opções de resposta
    answerOptions.forEach((btn, index) => {
        // Usa o texto da opção gerada
        btn.querySelector('.answer-text').textContent = newQ.options[index];
        btn.classList.remove('correct', 'wrong');
        btn.disabled = false;
    });

    // 4. Leitura de Voz
    speak(`Questão ${gameState.questionNumber}. Qual é o resultado de ${newQ.question}`);
    // Marca o início da questão (para missões e métricas)
    gameState.questionShownAt = Date.now();
}


/** Salva a pergunta que foi respondida incorretamente e persiste no localStorage. */
function saveError(question, userAnswer) {
    const errorData = {
        question: question.question,
        correctAnswer: question.answer,
        userAnswer: userAnswer,
        operation: question.operacao,
        num1: question.num1,
        num2: question.num2,
        srsKey: question.srsKey || makeSrsKey(question.operacao, question.num1, question.num2),
        timestamp: Date.now()
    };
    // Adiciona o novo erro no início da lista para manter os mais recentes visíveis
    gameState.errors.unshift(errorData); 
    salvarErros(); // Persiste no LocalStorage
    updateErrorTrainingButton();
}


function handleAnswer(selectedAnswer, selectedButton) {
    if (!gameState.isGameActive || selectedButton.disabled) return;

    if (gameState.isRapidMode) stopTimer();
    const elapsedQSec = gameState.questionShownAt ? (Date.now() - gameState.questionShownAt) / 1000 : 0;

    
    const isCorrect = selectedAnswer === gameState.currentQuestion.answer;
    // Atualiza SRS e Missão Diária (independente de ser modo rápido/estudo)
    updateSrsFromAnswer(gameState.currentQuestion, isCorrect);
    updateDailyMissionProgress(isCorrect, gameState.currentQuestion, elapsedQSec);

    const feedbackText = isCorrect ? 'RESPOSTA CORRETA!' : 'RESPOSTA INCORRETA!';
    
    // Desabilita todos os botões de resposta após o clique
    answerOptions.forEach(btn => btn.disabled = true);
    
    if (isCorrect) {
        selectedButton.classList.add('correct');
        
        // Revela a resposta correta em verde (se for outro botão)
        answerOptions.forEach(btn => {
            if (parseInt(btn.querySelector('.answer-text').textContent) === gameState.currentQuestion.answer) {
                 btn.classList.add('correct');
            }
        });

        // 3. Atualizar pontuação e XP
        gameState.acertos++;
        const scoreGain = gameState.isRapidMode ? 20 * gameState.questionNumber : 10;
        const xpGain = gameState.isRapidMode ? 5 : 2; 

        gameState.score += scoreGain;
        atualizarXP(xpGain);
        playerScoreElement.textContent = `${gameState.score} Pontos`;
        showFeedbackMessage(feedbackText, 'success');

    } else {
        selectedButton.classList.add('wrong');
        
        // Se errou, revela a resposta correta e a salva
        answerOptions.forEach(btn => {
            if (parseInt(btn.querySelector('.answer-text').textContent) === gameState.currentQuestion.answer) {
                 btn.classList.add('correct');
            }
        });
        
        gameState.erros++;
        atualizarXP(-2);
        saveError(gameState.currentQuestion, selectedAnswer); // Salva o erro na memória E LocalStorage
        showFeedbackMessage(feedbackText, 'warning');
    }

    // 4. Próxima pergunta após um pequeno atraso
    setTimeout(() => {
        if (gameState.isRapidMode) startTimer();
        nextQuestion();
    }, 1500);
}


function endGame() {
    gameState.isGameActive = false;
    if (gameState.isRapidMode) stopTimer();

    // 1. Calcular XP Ganhos na Rodada (apenas para exibição)
    const xpGained = gameState.acertos * (gameState.isRapidMode ? 5 : 2) - gameState.erros * 2;
    
    // 2. Atualizar UI de Resultados
    document.getElementById('final-score').textContent = gameState.score;
    document.getElementById('total-hits').textContent = gameState.acertos;
    document.getElementById('total-misses').textContent = gameState.erros;
    document.getElementById('xp-gained').textContent = `+${xpGained}`;
    document.getElementById('xp-total').textContent = gameState.xp;

    const studySuggestion = document.getElementById('study-suggestion');
    if (gameState.erros > gameState.acertos / 2) {
         studySuggestion.textContent = `Você teve muitos erros! Recomendamos usar o Modo Estudo para treinar a ${gameState.currentOperation} (Nível ${gameState.currentLevel.toUpperCase()}).`;
    } else if (gameState.score > 1000 && gameState.currentLevel === 'advanced') {
         studySuggestion.textContent = `Fantástico! Você está dominando a ${gameState.currentOperation} no Nível Avançado! Tente outro desafio.`;
    } else {
         studySuggestion.textContent = 'Continue praticando para alcançar o próximo nível de mestre!';
    }


    // 3. Mudar para a tela de resultado
    
// 4. Salva sessão (histórico do professor)
const endedAt = Date.now();
const durationSec = gameState.sessionStartAt ? Math.max(0, Math.round((endedAt - gameState.sessionStartAt) / 1000)) : 0;
const qCount = gameState.questionNumber || 0;
const accuracy = qCount ? (gameState.acertos / qCount) : 0;

const session = {
    ts: endedAt,
    date: localISODate(),
    operation: gameState.currentOperation,
    level: gameState.currentLevel,
    mode: gameState.isRapidMode ? 'rapido' : 'estudo',
    questions: qCount,
    correct: gameState.acertos,
    wrong: gameState.erros,
    accuracy,
    score: gameState.score,
    durationSec,
    xpTotal: gameState.xp
};

if (!Array.isArray(gameState.sessions)) gameState.sessions = [];
gameState.sessions.push(session);
salvarSessions();

// 5. Atualiza ranking local (top scores)
if (!Array.isArray(gameState.highScores)) gameState.highScores = [];
gameState.highScores.push({
    score: gameState.score,
    ts: endedAt,
    date: session.date,
    operation: session.operation,
    level: session.level,
    correct: session.correct,
    wrong: session.wrong
});
gameState.highScores.sort((a, b) => (b.score || 0) - (a.score || 0));
gameState.highScores = gameState.highScores.slice(0, 30);
salvarRanking();

renderTeacherPanel();

exibirTela('result-screen');
}


// --- LÓGICA DO TEMPORIZADOR ---

function startTimer() {
    if (gameState.timer) clearInterval(gameState.timer);
    if (!gameState.isRapidMode) return; // Não iniciar timer no modo estudo

    // Ajustamos o intervalo para rodar a cada 100ms (10 Ticks por segundo)
    gameState.timer = setInterval(() => {
        if (!gameState.isGameActive) {
            clearInterval(gameState.timer);
            return;
        }

        gameState.timeLeft--;

        if (gameState.timeLeft <= 0) {
            clearInterval(gameState.timer);
            playAlertSound();
            showFeedbackMessage("Tempo esgotado! Game Over!", 'error', 3000);
            endGame(); 
            return;
        }
        
        const percentage = (gameState.timeLeft / gameState.maxTime) * 100;
        
        // Atualiza a barra de progresso
        timeBar.style.width = `${percentage}%`;

        // Alerta visual de tempo baixo
        if (percentage < 25) {
            timeBar.style.backgroundColor = 'var(--cor-erro)';
            librasAlert.classList.remove('hidden');
            if (percentage < 10) playAlertSound(); // Toca o som no final
        } else if (percentage < 50) {
            timeBar.style.backgroundColor = 'var(--cor-secundaria)';
            librasAlert.classList.add('hidden');
        } else {
            timeBar.style.backgroundColor = 'var(--cor-sucesso)';
            librasAlert.classList.add('hidden');
        }
    }, 100); 
}

function stopTimer() {
    if (gameState.timer) {
        clearInterval(gameState.timer);
        gameState.timer = null;
    }
}


// --- LISTENERS DE EVENTOS ---

function attachEventListeners() {
    
    // 1. Seleção de Operação (Vai para a tela de Nível)
    operationButtons.forEach(button => {
        button.addEventListener('click', () => {
            const op = button.getAttribute('data-operation');

            // Multiplicação: abre modal (Trilha/Tabuada/Aleatório)
            if (op === 'multiplication') {
                openMultiplicationModeModal((cfg) => {
                    if (!cfg) return; // cancelado
                    gameState.multConfig = { 
                        mode: cfg.mode || 'random', 
                        tabuada: (cfg.tabuada !== null && cfg.tabuada !== undefined) ? Number(cfg.tabuada) : null,
                        currentTabuada: null
                    };

                    gameState.currentOperation = op;
                    exibirTela('level-selection-screen');

                    const modeLabel =
                        (gameState.multConfig.mode === 'trail') ? 'Trilha automática (Tabuadas 0–20)' :
                        (gameState.multConfig.mode === 'tabuada') ? `Tabuada do ${gameState.multConfig.tabuada}` :
                        'Aleatório';

                    speak(`Multiplicação selecionada. ${modeLabel}. Agora escolha o nível!`);
                    showFeedbackMessage(`Multiplicação selecionada: ${modeLabel}. Agora escolha o nível!`, 'info', 2800);
                });
                return;
            }

            // Demais operações: fluxo padrão
            gameState.currentOperation = op;

            exibirTela('level-selection-screen');
            speak(`Operação ${gameState.currentOperation} selecionada. Agora escolha o nível!`);
            showFeedbackMessage(`Operação ${gameState.currentOperation.toUpperCase()} selecionada. Agora escolha o nível!`, 'info', 2500);
        });
    })
    
    // 2. Seleção de Nível (Inicia o Jogo)
    levelButtons.forEach(button => {
        button.addEventListener('click', () => {
            const level = button.getAttribute('data-level');
            // Inicia o jogo com a operação já salva e o nível recém-clicado
            startGame(gameState.currentOperation, level); 
        });
    });

    // Botão para voltar da tela de nível para a home (Mudar Operação)
    btnVoltarHome.forEach(button => {
        // Garantindo que apenas os botões de voltar da home usem o ID 'btn-voltar-home'
        // Os demais botões de voltar home já devem ter o listener anexado.
        button.addEventListener('click', () => {
            stopTimer(); // Para o timer se estiver ativo (ex: saindo do jogo)
            exibirTela('home-screen');
        });
    });

    // 3. Botão de Quit Game (na tela de jogo)
    btnQuitGame.addEventListener('click', () => {
        stopTimer();
        if (gameState.isGameActive) {
            showFeedbackMessage("Rodada cancelada.", 'warning', 2000);
            gameState.isGameActive = false;
        }
        exibirTela('home-screen');
    });

    // 4. Opções de Resposta
    answerOptions.forEach(button => {
        button.addEventListener('click', (e) => {
            // O texto do botão é a resposta
            const answer = parseInt(e.currentTarget.querySelector('.answer-text').textContent); 
            handleAnswer(answer, e.currentTarget);
        });
    });

    // 5. Toggle Modo Rápido/Estudo
    modeRapidoBtn.addEventListener('click', () => {
        gameState.isRapidMode = true;
        modeRapidoBtn.classList.add('active');
        modeEstudoBtn.classList.remove('active');
        showFeedbackMessage("Modo Rápido (20 Questões com Tempo) selecionado!", 'incentive', 2500);
    });

    modeEstudoBtn.addEventListener('click', () => {
        gameState.isRapidMode = false;
        modeEstudoBtn.classList.add('active');
        modeRapidoBtn.classList.remove('active');
        showFeedbackMessage("Modo Estudo (Infinito, Sem Tempo) selecionado! Use o botão 'Mostrar Resposta' para aprender.", 'incentive', 2500);
    });

    // 6. Toggle Leitura de Voz
    if (toggleVoiceRead) {
        toggleVoiceRead.addEventListener('click', () => {
            const isActive = !gameState.isVoiceReadActive;
            gameState.isVoiceReadActive = isActive;
            toggleVoiceRead.classList.toggle('active', isActive);
            if(synth) synth.cancel();
            speak(`Leitura de Voz ${isActive ? 'ativada' : 'desativada'}!`);
            showFeedbackMessage(`Leitura de Voz ${isActive ? 'ativada' : 'desativada'}!`, 'info', 2000);
        });
    }
    
    // 7. Toggle Modo Libras 
    if (toggleLibras) {
        toggleLibras.addEventListener('click', () => {
            const isActive = document.body.classList.toggle('libras-mode');
            toggleLibras.classList.toggle('active', isActive);
            const message = isActive 
                ? 'Modo Libras (Acessibilidade) ATIVADO! O tempo de jogo será dobrado no Modo Rápido.'
                : 'Modo Libras DESATIVADO.';
            showFeedbackMessage(message, 'info', 3000);
        });
    }

    // 8. Lógica para Dark/Light Mode
    if (toggleNightMode) {
         toggleNightMode.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            document.body.classList.toggle('dark-mode');
            const isDarkMode = document.body.classList.contains('dark-mode');
            toggleNightMode.querySelector('.icon').textContent = isDarkMode ? '☀️' : '🌙';
        });
    }

    // 9. Botões de Ação do Jogo (Estender Tempo / Ajuda)
    btnExtendTime.addEventListener('click', () => {
        const cost = 100;
        if (gameState.xp >= cost) {
            atualizarXP(-cost);
            // Adiciona 50 ticks (+5 segundos)
            gameState.timeLeft = Math.min(gameState.maxTime, gameState.timeLeft + 50); 
            showFeedbackMessage("Tempo estendido! +5 segundos!", 'success');
        } else {
             showFeedbackMessage(`XP insuficiente. Você precisa de ${cost} XP!`, 'error');
        }
    });

    btnShowAnswer.addEventListener('click', () => {
        const cost = 250;
        if (gameState.xp >= cost) {
            atualizarXP(-cost);
            // Mostra a resposta correta e desabilita os botões para forçar o avanço
            answerOptions.forEach(btn => {
                const answerElement = btn.querySelector('.answer-text');
                if (parseInt(answerElement.textContent) === gameState.currentQuestion.answer) {
                    btn.classList.add('correct');
                }
                btn.disabled = true; 
            });
            stopTimer();
            showFeedbackMessage(`A resposta correta era ${gameState.currentQuestion.answer}. Treine mais!`, 'warning', 3500);

             // Avança para a próxima questão após 3 segundos
            setTimeout(() => {
                if (gameState.isRapidMode) startTimer();
                nextQuestion();
            }, 3000);

        } else {
             showFeedbackMessage(`XP insuficiente. Você precisa de ${cost} XP!`, 'error');
        }
    });
    
    // 10. Navegação para Ranking e Erros
    document.getElementById('btn-show-ranking').addEventListener('click', () => {
        carregarRanking();
        const container = document.getElementById('ranking-list-container');
        if (container) {
            const list = Array.isArray(gameState.highScores) ? gameState.highScores : [];
            if (!list.length) {
                container.innerHTML = `<p style="opacity:.8;margin-top:10px;">Ainda não há pontuações salvas. Jogue uma partida no modo rápido 😊</p>`;
            } else {
                container.innerHTML = `
                  <ol style="margin:12px 0 0 18px;padding:0;">
                    ${list.slice(0, 15).map((it, idx) => {
                        const date = it.date || (it.ts ? new Date(it.ts).toLocaleDateString('pt-BR') : '');
                        const op = opLabel(it.operation);
                        const lvl = (it.level || '').toUpperCase();
                        const acc = (it.correct + it.wrong) ? Math.round((it.correct / (it.correct + it.wrong)) * 100) : 0;
                        return `<li style="margin:8px 0;">
                            <b>#${idx+1}</b> — <b>${it.score || 0}</b> pts
                            <div style="opacity:.85;font-size:.9em;">${op} • ${lvl} • ${acc}% • ${date}</div>
                        </li>`;
                    }).join('')}
                  </ol>
                `;
            }
        }
        exibirTela('ranking-screen');
    });

    const btnClearRanking = document.getElementById('btn-clear-ranking');
    if (btnClearRanking) {
        btnClearRanking.addEventListener('click', () => {
            const typed = prompt('Digite RESET para apagar o ranking deste perfil.');
            if (typed !== 'RESET') return;
            gameState.highScores = [];
            salvarRanking();
            const container = document.getElementById('ranking-list-container');
            if (container) container.innerHTML = `<p style="opacity:.8;margin-top:10px;">Ranking limpo.</p>`;
            showFeedbackMessage('Ranking limpo.', 'info', 1800);
        });
    }
    
    // Botão para ir para a tela de treinamento de erros (da tela de resultados)
    if (btnTreinarErros) {
        btnTreinarErros.addEventListener('click', () => {
            updateErrorTrainingButton(); // Atualiza a lista e mensagem
            exibirTela('error-training-screen');
        });
    }

    // Botão para limpar a lista de erros salvos
    if (btnClearErrors) {
        btnClearErrors.addEventListener('click', () => {
            if (confirm("Tem certeza que deseja limpar todos os erros salvos?")) {
                gameState.errors = [];
                salvarErros();
                showFeedbackMessage("Erros salvos limpos com sucesso!", 'info');
                updateErrorTrainingButton();
            }
        });
    }

    // TODO: Implementar a lógica de iniciar o Treinamento de Erros (futuro)
    // if (btnStartTraining) { ... }


    // Inicialização final
    exibirTela(gameState.currentScreen);

}


// --- INICIALIZAÇÃO DO DOCUMENTO ---

document.addEventListener('DOMContentLoaded', () => {
    // 0) Migração + Perfil ativo (A/B/C)
    migrateLegacyStorageToProfileA();
    loadActiveProfile();

    // 1) Carrega estado persistente do perfil
    carregarXP();
    carregarErros();
    carregarSrsItems();
    carregarSessions();
    carregarRanking();
    ensureDailyMission();

    // 2) Anexa listeners do app
    attachEventListeners();

    // 3) Atualiza estado inicial do botão de Treinar Erros
    updateErrorTrainingButton();

    // 4) Painel do professor (injeção)
    setupTeacherUI();

    // Aplica o Dark Mode se o body já tiver a classe
    if (document.body.classList.contains('dark-mode')) {
        toggleNightMode.querySelector('.icon').textContent = '☀️';
    }
});