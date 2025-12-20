
/* =========================================================================
   Matemágica – V2 (Trilhas + Prática + Professor)
   Tudo em client-side (gratuito), usando localStorage.
   ========================================================================= */

(() => {
  "use strict";

  const APP = {
    name: "Matemágica",
    version: "2.0.0",
    storage: {
      profiles: "mm_profiles_v1",
      activeProfileId: "mm_active_profile_id",
      progressPrefix: "mm_progress_",
      teacherDb: "mm_teacher_db_v1",
      settingsGlobal: "mm_settings_global_v1",
    },
    freezePrice: 150,
    passScore: 0.80,
    srIntervalsDays: [1, 3, 7, 14, 30, 60],
  };

  /* =========================
     Helpers
     ========================= */

  const $ = (id) => document.getElementById(id);

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function todayKey() {
    // Usa o fuso do navegador (suficiente para uso escolar local).
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function parseDateKey(key) {
    // "YYYY-MM-DD"
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0); // meio-dia (evita edge DST)
  }

  function diffDays(fromKey, toKey) {
    const a = parseDateKey(fromKey);
    const b = parseDateKey(toKey);
    const ms = b.getTime() - a.getTime();
    return Math.round(ms / (1000 * 60 * 60 * 24));
  }

  function formatDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm} ${hh}:${mi}`;
  }

  function isoWeekKey(date = new Date()) {
    // ISO week key: YYYY-Www
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    const yyyy = d.getUTCFullYear();
    return `${yyyy}-W${String(weekNo).padStart(2, "0")}`;
  }

  function safeJsonParse(str, fallback) {
    try { return JSON.parse(str); } catch { return fallback; }
  }

  function load(key, fallback) {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return safeJsonParse(raw, fallback);
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  function downloadJson(filename, obj) {
    downloadText(filename, JSON.stringify(obj, null, 2));
  }

  function downloadCsv(filename, csvText) {
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  function toast(msg) {
    const el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), 2800);
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) {
      toast("Seu navegador não suporta leitura por voz.");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    u.rate = 1;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const el = $(id);
    if (el) el.classList.add("active");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function normalizeName(name) {
    return String(name || "").trim().replace(/\s+/g, " ").slice(0, 20);
  }

  function trackKeyFromGrade(gradeYear) {
    const g = Number(gradeYear);
    if (g >= 1 && g <= 9) return `g${g}`;
    if (g === 10) return "em1";
    if (g === 11) return "em2";
    if (g === 12) return "em3";
    return "g6";
  }

  function gradeLabel(gradeYear) {
    const g = Number(gradeYear);
    if (g >= 1 && g <= 9) return `${g}º ano`;
    if (g === 10) return "1º EM";
    if (g === 11) return "2º EM";
    if (g === 12) return "3º EM";
    return `${g}`;
  }

  /* =========================
     Content – Tracks & Skills
     ========================= */

  // Catálogo mínimo e escalável: 4 unidades por ano (MVP) + OBMEP-like semanal.
  // Você pode expandir adicionando unidades e geradores sem quebrar o histórico.

  const SKILL_META = {
    // EF I
    g1_count_succ: { title: "Contagem: sucessor", axis: "sentido_num" },
    g1_add_10: { title: "Adição até 10", axis: "operacoes" },
    g1_sub_10: { title: "Subtração até 10", axis: "operacoes" },
    g1_patterns: { title: "Padrões simples", axis: "raciocinio" },

    g2_place_value: { title: "Valor posicional (dezenas/unidades)", axis: "sentido_num" },
    g2_add_100: { title: "Adição até 100", axis: "operacoes" },
    g2_sub_100: { title: "Subtração até 100", axis: "operacoes" },
    g2_mul_groups: { title: "Multiplicação como grupos", axis: "operacoes" },

    g3_mul_facts_2_5: { title: "Tabuada 2–5", axis: "operacoes" },
    g3_div_sharing: { title: "Divisão: repartir", axis: "operacoes" },
    g3_frac_halves: { title: "Frações: metade/terço", axis: "fracoes" },
    g3_area_rect: { title: "Área/perímetro: retângulo", axis: "geometria" },

    g4_mul_facts_6_9: { title: "Tabuada 6–9", axis: "operacoes" },
    g4_mul_2digit: { title: "Multiplicação (2 dígitos)", axis: "operacoes" },
    g4_frac_equiv: { title: "Frações: equivalência", axis: "fracoes" },
    g4_decimals_01: { title: "Decimais: décimos/centésimos", axis: "decimais" },

    g5_div_2digit: { title: "Divisão (2 dígitos)", axis: "operacoes" },
    g5_frac_add_like: { title: "Frações: soma (mesmo denom.)", axis: "fracoes" },
    g5_dec_addsub: { title: "Decimais: soma/subtração", axis: "decimais" },
    g5_percent_intro: { title: "Porcentagem: noções", axis: "percent" },

    // EF II
    g6_order_ops: { title: "Ordem das operações", axis: "algebra_base" },
    g6_dec_compare: { title: "Decimais: comparar", axis: "decimais" },
    g6_frac_equiv: { title: "Frações: equivalência", axis: "fracoes" },
    g6_percent_simple: { title: "Porcentagem 10/25/50", axis: "percent" },

    g7_int_ops: { title: "Inteiros: operações", axis: "algebra_base" },
    g7_prop: { title: "Proporcionalidade", axis: "algebra_base" },
    g7_eq_1step: { title: "Equações: 1 passo", axis: "algebra" },
    g7_area: { title: "Áreas básicas", axis: "geometria" },

    g8_algebra_simplify: { title: "Álgebra: simplificar", axis: "algebra" },
    g8_eq_linear: { title: "Equação do 1º grau", axis: "algebra" },
    g8_functions_intro: { title: "Funções: avaliar", axis: "funcoes" },
    g8_powers: { title: "Potências", axis: "algebra_base" },

    g9_systems: { title: "Sistema linear (simples)", axis: "algebra" },
    g9_quadratic: { title: "Quadrática: forma/fatoração", axis: "algebra" },
    g9_similarity: { title: "Semelhança", axis: "geometria" },
    g9_probability: { title: "Probabilidade básica", axis: "prob" },

    // EM
    em1_functions: { title: "Função afim/quadrática", axis: "funcoes" },
    em1_factor: { title: "Fatoração", axis: "algebra" },
    em1_trig: { title: "Trigonometria básica", axis: "geometria" },
    em1_stats: { title: "Estatística: média/mediana", axis: "stats" },

    em2_exp_log: { title: "Exponencial e log", axis: "funcoes" },
    em2_seq: { title: "PA/PG", axis: "funcoes" },
    em2_comb: { title: "Análise combinatória", axis: "prob" },
    em2_geo_analytic: { title: "Geometria analítica", axis: "geometria" },

    em3_prob: { title: "Probabilidade (nível EM)", axis: "prob" },
    em3_matrices: { title: "Matrizes (básico)", axis: "algebra" },
    em3_complex: { title: "Complexos (básico)", axis: "algebra" },
    em3_limits: { title: "Pré-cálculo: limites (intuitivo)", axis: "funcoes" },

    // OBMEP-like
    ob_patterns: { title: "OBMEP-like: padrões", axis: "raciocinio" },
    ob_parity: { title: "OBMEP-like: paridade", axis: "raciocinio" },
    ob_counting: { title: "OBMEP-like: contagem", axis: "raciocinio" },
  };

  function buildTracks() {
    const tracks = {};

    function unit(trackKey, idx, title, skillIds, prereq = []) {
      const unitId = `${trackKey}_u${idx}`;
      const nodes = [
        { nodeId: `${unitId}_l1`, type: "L", title: "Lição 1", skillIds, prereq },
        { nodeId: `${unitId}_l2`, type: "L", title: "Lição 2", skillIds, prereq },
        { nodeId: `${unitId}_r1`, type: "R", title: "Revisão", skillIds, prereq },
        { nodeId: `${unitId}_b1`, type: "B", title: "Chefão (80%)", skillIds, prereq },
      ];
      return { unitId, title, skillIds, prereq, nodes };
    }

    function addTrack(trackKey, gradeYear, units) {
      tracks[trackKey] = { trackKey, gradeYear, units };
    }

    // EF I
    addTrack("g1", 1, [
      unit("g1", 1, "Contagem e sucessor", ["g1_count_succ"]),
      unit("g1", 2, "Adição até 10", ["g1_add_10"]),
      unit("g1", 3, "Subtração até 10", ["g1_sub_10"]),
      unit("g1", 4, "Padrões", ["g1_patterns"]),
    ]);

    addTrack("g2", 2, [
      unit("g2", 1, "Valor posicional", ["g2_place_value"]),
      unit("g2", 2, "Adição até 100", ["g2_add_100"], ["g1_add_10"]),
      unit("g2", 3, "Subtração até 100", ["g2_sub_100"], ["g1_sub_10"]),
      unit("g2", 4, "Multiplicação como grupos", ["g2_mul_groups"], ["g2_add_100"]),
    ]);

    addTrack("g3", 3, [
      unit("g3", 1, "Tabuada 2–5", ["g3_mul_facts_2_5"], ["g2_mul_groups"]),
      unit("g3", 2, "Divisão: repartir", ["g3_div_sharing"], ["g3_mul_facts_2_5"]),
      unit("g3", 3, "Frações: metade e terço", ["g3_frac_halves"]),
      unit("g3", 4, "Área e perímetro (retângulo)", ["g3_area_rect"]),
    ]);

    addTrack("g4", 4, [
      unit("g4", 1, "Tabuada 6–9", ["g4_mul_facts_6_9"], ["g3_mul_facts_2_5"]),
      unit("g4", 2, "Multiplicação (2 dígitos)", ["g4_mul_2digit"], ["g4_mul_facts_6_9"]),
      unit("g4", 3, "Frações: equivalência", ["g4_frac_equiv"], ["g3_frac_halves"]),
      unit("g4", 4, "Decimais: décimos/centésimos", ["g4_decimals_01"]),
    ]);

    addTrack("g5", 5, [
      unit("g5", 1, "Divisão (2 dígitos)", ["g5_div_2digit"], ["g4_mul_facts_6_9"]),
      unit("g5", 2, "Frações: soma (mesmo denominador)", ["g5_frac_add_like"], ["g4_frac_equiv"]),
      unit("g5", 3, "Decimais: soma e subtração", ["g5_dec_addsub"], ["g4_decimals_01"]),
      unit("g5", 4, "Porcentagem: noções", ["g5_percent_intro"], ["g5_dec_addsub"]),
    ]);

    // EF II
    addTrack("g6", 6, [
      unit("g6", 1, "Ordem das operações", ["g6_order_ops"]),
      unit("g6", 2, "Decimais: comparar", ["g6_dec_compare"], ["g4_decimals_01"]),
      unit("g6", 3, "Frações: equivalência", ["g6_frac_equiv"], ["g4_frac_equiv"]),
      unit("g6", 4, "Porcentagem 10/25/50", ["g6_percent_simple"], ["g5_percent_intro"]),
    ]);

    addTrack("g7", 7, [
      unit("g7", 1, "Inteiros: operações", ["g7_int_ops"], ["g6_order_ops"]),
      unit("g7", 2, "Proporcionalidade", ["g7_prop"], ["g6_percent_simple"]),
      unit("g7", 3, "Equações: 1 passo", ["g7_eq_1step"], ["g7_int_ops"]),
      unit("g7", 4, "Áreas básicas", ["g7_area"], ["g3_area_rect"]),
    ]);

    addTrack("g8", 8, [
      unit("g8", 1, "Álgebra: simplificar", ["g8_algebra_simplify"], ["g7_eq_1step"]),
      unit("g8", 2, "Equação do 1º grau", ["g8_eq_linear"], ["g8_algebra_simplify"]),
      unit("g8", 3, "Funções: avaliar", ["g8_functions_intro"], ["g8_eq_linear"]),
      unit("g8", 4, "Potências", ["g8_powers"], ["g6_order_ops"]),
    ]);

    addTrack("g9", 9, [
      unit("g9", 1, "Sistema linear (simples)", ["g9_systems"], ["g8_eq_linear"]),
      unit("g9", 2, "Quadrática: fatoração", ["g9_quadratic"], ["g8_algebra_simplify"]),
      unit("g9", 3, "Semelhança", ["g9_similarity"], ["g7_prop"]),
      unit("g9", 4, "Probabilidade básica", ["g9_probability"]),
    ]);

    // EM
    addTrack("em1", 10, [
      unit("em1", 1, "Funções (afim/quadrática)", ["em1_functions"], ["g9_quadratic"]),
      unit("em1", 2, "Fatoração", ["em1_factor"], ["g9_quadratic"]),
      unit("em1", 3, "Trigonometria básica", ["em1_trig"], ["g9_similarity"]),
      unit("em1", 4, "Estatística (média/mediana)", ["em1_stats"], ["g9_probability"]),
    ]);

    addTrack("em2", 11, [
      unit("em2", 1, "Exponencial e log", ["em2_exp_log"], ["em1_functions"]),
      unit("em2", 2, "PA/PG", ["em2_seq"], ["em1_functions"]),
      unit("em2", 3, "Análise combinatória", ["em2_comb"], ["g9_probability"]),
      unit("em2", 4, "Geometria analítica", ["em2_geo_analytic"], ["g8_functions_intro"]),
    ]);

    addTrack("em3", 12, [
      unit("em3", 1, "Probabilidade (EM)", ["em3_prob"], ["em2_comb"]),
      unit("em3", 2, "Matrizes (básico)", ["em3_matrices"]),
      unit("em3", 3, "Complexos (básico)", ["em3_complex"]),
      unit("em3", 4, "Pré-cálculo: limites", ["em3_limits"], ["em2_exp_log"]),
    ]);

    return tracks;
  }

  const TRACKS = buildTracks();

  /* =========================
     Question Generators
     ========================= */

  function makeMCQ(prompt, correct, distractors, hint, meta = {}) {
    const options = shuffle([correct, ...distractors].slice(0, 4));
    return { prompt, correct, options, hint: hint || "", ...meta };
  }

  function numDistractors(correct, spread = 10) {
    const set = new Set();
    while (set.size < 3) {
      const d = correct + randInt(-spread, spread);
      if (d !== correct) set.add(d);
    }
    return Array.from(set);
  }

  function fractionStr(n, d) { return `${n}/${d}`; }

  function genCountingSucc() {
    const n = randInt(0, 19);
    const correct = n + 1;
    return makeMCQ(
      `Qual número vem depois de ${n}?`,
      String(correct),
      numDistractors(correct, 4).map(String),
      "Dica: conte mais 1.",
      { skillId: "g1_count_succ", errorType: "E_CONCEPT" }
    );
  }

  function genAdd(max) {
    const a = randInt(0, max);
    const b = randInt(0, max);
    const correct = a + b;
    return makeMCQ(
      `${a} + ${b} = ?`,
      String(correct),
      numDistractors(correct, Math.max(5, Math.floor(max / 2))).map(String),
      "Dica: junte as quantidades.",
      { errorType: "E_FACT" }
    );
  }

  function genSub(max) {
    const a = randInt(0, max);
    const b = randInt(0, a);
    const correct = a - b;
    return makeMCQ(
      `${a} − ${b} = ?`,
      String(correct),
      numDistractors(correct, Math.max(5, Math.floor(max / 2))).map(String),
      "Dica: pense em tirar uma parte.",
      { errorType: "E_FACT" }
    );
  }

  function genPlaceValue() {
    // Ex.: 47 -> dezenas=4
    const n = randInt(10, 99);
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    const askTens = Math.random() < 0.5;
    const correct = askTens ? tens : ones;
    const prompt = askTens
      ? `No número ${n}, quantas dezenas existem?`
      : `No número ${n}, quantas unidades existem?`;
    const distractors = shuffle([correct + 1, Math.max(0, correct - 1), randInt(0, 9)])
      .filter(v => v !== correct)
      .slice(0, 3);
    return makeMCQ(
      prompt,
      String(correct),
      distractors.map(String),
      "Dica: separe dezenas e unidades.",
      { skillId: "g2_place_value", errorType: "E_PLACE" }
    );
  }

  function genMulFacts(minA, maxA) {
    const a = randInt(minA, maxA);
    const b = randInt(0, 10);
    const correct = a * b;
    const distractors = new Set();
    distractors.add(a * clamp(b + 1, 0, 10));
    distractors.add(a * clamp(b - 1, 0, 10));
    distractors.add((a + 1) * b);
    const d = Array.from(distractors).filter(x => x !== correct).slice(0, 3);
    while (d.length < 3) d.push(correct + randInt(1, 9));
    return makeMCQ(
      `${a} × ${b} = ?`,
      String(correct),
      d.map(String),
      "Dica: use a tabuada ou soma repetida.",
      { errorType: "E_FACT" }
    );
  }

  function genMulGroups() {
    // Ex.: 4 grupos de 3 = ?
    const groups = randInt(2, 6);
    const each = randInt(2, 6);
    const correct = groups * each;
    return makeMCQ(
      `${groups} grupos de ${each} formam quantos ao todo?`,
      String(correct),
      numDistractors(correct, 6).map(String),
      "Dica: é uma multiplicação: grupos × quantidade.",
      { skillId: "g2_mul_groups", errorType: "E_CONCEPT" }
    );
  }

  function genDivSharing() {
    const each = randInt(2, 6);
    const groups = randInt(2, 6);
    const total = each * groups;
    const correct = groups;
    return makeMCQ(
      `Se ${total} balas são divididas em grupos de ${each}, quantos grupos se formam?`,
      String(correct),
      numDistractors(correct, 4).map(String),
      "Dica: divisão é repartir em partes iguais.",
      { errorType: "E_CONCEPT" }
    );
  }

  function genAreaRect() {
    const w = randInt(2, 10);
    const h = randInt(2, 10);
    const correct = w * h;
    return makeMCQ(
      `Um retângulo tem ${w} de largura e ${h} de altura. Qual é a área?`,
      String(correct),
      [String(w + h), String(2 * (w + h)), String(correct + randInt(1, 8))],
      "Dica: área do retângulo = largura × altura.",
      { errorType: "E_CONCEPT" }
    );
  }

  function genFracHalves() {
    const prompt = "Qual fração representa a metade?";
    const correct = "1/2";
    const distractors = ["1/3", "2/3", "2/4"];
    return makeMCQ(prompt, correct, distractors, "Dica: metade é dividir em 2 partes iguais.", { errorType: "E_CONCEPT" });
  }

  function genFracEquiv() {
    const baseN = randInt(1, 4);
    const baseD = randInt(baseN + 1, 6);
    const k = randInt(2, 4);
    const correct = fractionStr(baseN * k, baseD * k);
    const prompt = `Qual fração é equivalente a ${fractionStr(baseN, baseD)}?`;
    const distractors = [
      fractionStr(baseN + 1, baseD),
      fractionStr(baseN, baseD + 1),
      fractionStr(baseN * (k + 1), baseD * k),
    ];
    return makeMCQ(prompt, correct, distractors, "Dica: multiplique numerador e denominador pelo mesmo número.", { errorType: "E_CONCEPT" });
  }

  function genDecimals01() {
    const a = randInt(10, 99);
    const b = randInt(10, 99);
    const x = (a / 100).toFixed(2);
    const y = (b / 100).toFixed(2);
    const correct = (a > b) ? x : y;
    const prompt = `Qual é o maior número: ${x} ou ${y}?`;
    const distractors = [a === b ? x : (a > b ? y : x), (randInt(10,99)/100).toFixed(2), (randInt(10,99)/100).toFixed(2)];
    return makeMCQ(prompt, correct, distractors, "Dica: compare primeiro os décimos, depois os centésimos.", { errorType: "E_PLACE" });
  }

  function genDecimalsCompare() {
    // Com zeros para provocar erro comum: 0.5 vs 0.50 etc.
    const a = randInt(0, 9);
    const b = randInt(0, 9);
    const c = randInt(0, 9);
    const d = randInt(0, 9);

    const n1 = `${a}.${b}${Math.random() < 0.6 ? "0" : c}`;
    const n2 = `${a}.${d}${Math.random() < 0.6 ? "0" : c}`;
    const v1 = Number(n1);
    const v2 = Number(n2);
    const correct = v1 > v2 ? n1 : (v2 > v1 ? n2 : "Iguais");
    const prompt = `Qual é maior: ${n1} ou ${n2}?`;
    const options = shuffle([n1, n2, "Iguais", `${a}.${b}${d}`]).slice(0,4);
    return { prompt, correct, options, hint: "Dica: zeros à direita não mudam o valor (0,5 = 0,50).", skillId: "g6_dec_compare", errorType: "E_PLACE" };
  }

  function genPercentSimple() {
    const base = [40, 60, 80, 100, 120][randInt(0,4)];
    const p = [10, 25, 50][randInt(0,2)];
    const correct = base * p / 100;
    const prompt = `${p}% de ${base} = ?`;
    const distractors = numDistractors(correct, 20).map(String);
    return makeMCQ(prompt, String(correct), distractors, "Dica: 50% é metade; 25% é a metade da metade; 10% é a décima parte.", { skillId: "g6_percent_simple", errorType: "E_CONCEPT" });
  }

  function genOrderOps() {
    // Expressões pequenas
    const a = randInt(2, 9);
    const b = randInt(2, 9);
    const c = randInt(1, 9);
    const usePar = Math.random() < 0.5;
    let expr, correct;
    if (usePar) {
      expr = `(${a} + ${b}) × ${c}`;
      correct = (a + b) * c;
    } else {
      expr = `${a} + ${b} × ${c}`;
      correct = a + b * c;
    }
    return makeMCQ(`${expr} = ?`, String(correct), numDistractors(correct, 15).map(String),
      "Dica: multiplica antes de somar (a não ser que tenha parênteses).",
      { skillId: "g6_order_ops", errorType: "E_PROC" }
    );
  }

  function genIntegersOps() {
    const a = randInt(-10, 10);
    const b = randInt(-10, 10);
    const ops = ["+", "−"][randInt(0,1)];
    const correct = ops === "+" ? a + b : a - b;
    const prompt = `${a} ${ops} ${b} = ?`;
    return makeMCQ(prompt, String(correct), numDistractors(correct, 10).map(String),
      "Dica: cuidado com os sinais.",
      { skillId: "g7_int_ops", errorType: "E_PROC" }
    );
  }

  function genProp() {
    // Proporção simples: 3 -> 12; 5 -> ?
    const x1 = randInt(2, 6);
    const k = randInt(2, 5);
    const y1 = x1 * k;
    const x2 = randInt(2, 8);
    const correct = x2 * k;
    return makeMCQ(
      `Se ${x1} vira ${y1}, então ${x2} vira quanto (mesma proporção)?`,
      String(correct),
      numDistractors(correct, 12).map(String),
      "Dica: descubra o fator de multiplicação.",
      { skillId: "g7_prop", errorType: "E_CONCEPT" }
    );
  }

  function genEq1Step() {
    // x + a = b  OR  x - a = b
    const a = randInt(1, 9);
    const x = randInt(1, 12);
    const plus = Math.random() < 0.5;
    const b = plus ? x + a : x - a;
    const prompt = plus ? `x + ${a} = ${b}. Qual é x?` : `x − ${a} = ${b}. Qual é x?`;
    const correct = x;
    return makeMCQ(prompt, String(correct), numDistractors(correct, 8).map(String), "Dica: isole o x (faça a operação inversa).", { skillId: "g7_eq_1step", errorType: "E_PROC" });
  }

  function genAlgebraSimplify() {
    // ax + bx = ?
    const a = randInt(1, 9);
    const b = randInt(1, 9);
    const correct = a + b;
    const prompt = `Simplifique: ${a}x + ${b}x = ?`;
    const options = shuffle([`${correct}x`, `${a}x`, `${b}x`, `${a+b+1}x`]);
    return { prompt, correct: `${correct}x`, options, hint: "Dica: some os coeficientes de termos semelhantes.", skillId: "g8_algebra_simplify", errorType: "E_CONCEPT" };
  }

  function genEqLinear() {
    // ax + b = c
    const a = randInt(2, 6);
    const x = randInt(1, 10);
    const b = randInt(-6, 6);
    const c = a * x + b;
    const prompt = `Resolva: ${a}x ${b >= 0 ? "+" : "−"} ${Math.abs(b)} = ${c}.`;
    const correct = x;
    return makeMCQ(prompt, String(correct), numDistractors(correct, 8).map(String), "Dica: isole x: subtraia/adicione b e divida por a.", { skillId: "g8_eq_linear", errorType: "E_PROC" });
  }

  function genFunctionEval() {
    const a = randInt(-3, 5);
    const b = randInt(-6, 6);
    const x = randInt(-4, 4);
    const correct = a * x + b;
    const prompt = `Se f(x) = ${a}x ${b >= 0 ? "+" : "−"} ${Math.abs(b)}, então f(${x}) = ?`;
    return makeMCQ(prompt, String(correct), numDistractors(correct, 12).map(String), "Dica: substitua x e calcule.", { skillId: "g8_functions_intro", errorType: "E_PROC" });
  }

  function genPowers() {
    const base = randInt(2, 6);
    const exp = randInt(2, 4);
    const correct = Math.pow(base, exp);
    return makeMCQ(`${base}^${exp} = ?`, String(correct), numDistractors(correct, 20).map(String), "Dica: potência é multiplicar o número por ele mesmo.", { skillId: "g8_powers", errorType: "E_FACT" });
  }

  function genSystems() {
    // sistema simples: x + y = s ; x - y = d
    const x = randInt(1, 8);
    const y = randInt(1, 8);
    const s = x + y;
    const d = x - y;
    const prompt = `Se x + y = ${s} e x − y = ${d}, quanto vale x?`;
    return makeMCQ(prompt, String(x), numDistractors(x, 6).map(String), "Dica: some as duas equações para eliminar y.", { skillId: "g9_systems", errorType: "E_CONCEPT" });
  }

  function genQuadratic() {
    // (x+p)(x+q) => x^2 + (p+q)x + pq
    const p = randInt(1, 6);
    const q = randInt(1, 6);
    const b = p + q;
    const c = p * q;
    const prompt = `Fatore: x² + ${b}x + ${c}`;
    const correct = `(x+${p})(x+${q})`;
    const options = shuffle([
      correct,
      `(x+${p+1})(x+${q})`,
      `(x+${p})(x+${q+1})`,
      `(x+${b})(x+${c})`
    ]);
    return { prompt, correct, options, hint: "Dica: procure dois números que somam b e multiplicam c.", skillId: "g9_quadratic", errorType: "E_CONCEPT" };
  }

  function genSimilarity() {
    // razão simples
    const a = randInt(2, 6);
    const b = randInt(2, 6);
    const k = randInt(2, 5);
    const correct = b * k;
    return makeMCQ(
      `Em figuras semelhantes, se ${a} cm vira ${a*k} cm, então ${b} cm vira quanto?`,
      String(correct),
      numDistractors(correct, 10).map(String),
      "Dica: use a mesma razão (fator de escala).",
      { skillId: "g9_similarity", errorType: "E_CONCEPT" }
    );
  }

  function genProbability() {
    const total = 6;
    const favorable = randInt(1, 5);
    const correct = `${favorable}/${total}`;
    const prompt = `Em um dado comum, a probabilidade de sair um número em {1..${favorable}} é:`;
    const options = shuffle([correct, `${favorable+1}/${total}`, `${favorable}/${total+1}`, `1/${total}`]);
    return { prompt, correct, options, hint: "Dica: probabilidade = casos favoráveis / casos possíveis.", skillId: "g9_probability", errorType: "E_CONCEPT" };
  }

  function genStats() {
    const a = randInt(1, 9);
    const b = randInt(1, 9);
    const c = randInt(1, 9);
    const mean = ((a + b + c) / 3);
    const correct = mean.toFixed(1).replace(".0", "");
    const prompt = `Qual é a média de ${a}, ${b} e ${c}?`;
    const distractors = [String(Math.round(mean)), String(a+b+c), String(mean+1)];
    return makeMCQ(prompt, correct, distractors, "Dica: some e divida por 3.", { skillId: "em1_stats", errorType: "E_PROC" });
  }

  function genExpLog() {
    // exponencial simples
    const base = randInt(2, 5);
    const exp = randInt(2, 4);
    const val = Math.pow(base, exp);
    const prompt = `Se ${base}^x = ${val}, então x = ?`;
    const correct = exp;
    return makeMCQ(prompt, String(correct), numDistractors(correct, 4).map(String), "Dica: veja qual expoente gera o valor.", { skillId: "em2_exp_log", errorType: "E_CONCEPT" });
  }

  function genSeq() {
    const a1 = randInt(1, 6);
    const r = randInt(2, 6);
    const n = randInt(3, 6);
    const an = a1 + (n - 1) * r;
    const prompt = `Em uma PA com a₁=${a1} e r=${r}, qual é a₍${n}₎?`;
    return makeMCQ(prompt, String(an), numDistractors(an, 10).map(String), "Dica: aₙ = a₁ + (n−1)r.", { skillId: "em2_seq", errorType: "E_CONCEPT" });
  }

  function genComb() {
    const shirts = randInt(2, 5);
    const pants = randInt(2, 5);
    const correct = shirts * pants;
    const prompt = `Se há ${shirts} camisas e ${pants} calças, quantos looks diferentes (1 camisa e 1 calça) existem?`;
    return makeMCQ(prompt, String(correct), numDistractors(correct, 6).map(String), "Dica: use o princípio multiplicativo.", { skillId: "em2_comb", errorType: "E_CONCEPT" });
  }

  function genGeoAnalytic() {
    const x1 = randInt(-4, 4);
    const y1 = randInt(-4, 4);
    const x2 = randInt(-4, 4);
    const y2 = randInt(-4, 4);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist2 = dx*dx + dy*dy;
    const prompt = `A distância ao quadrado entre (${x1},${y1}) e (${x2},${y2}) é:`;
    return makeMCQ(prompt, String(dist2), numDistractors(dist2, 10).map(String), "Dica: d² = (Δx)² + (Δy)².", { skillId: "em2_geo_analytic", errorType: "E_PROC" });
  }

  function genMatrices() {
    const a = randInt(0, 5), b = randInt(0, 5), c = randInt(0, 5), d = randInt(0, 5);
    const prompt = `A soma das matrizes [[${a},${b}],[${c},${d}]] + [[1,1],[1,1]] é:`;
    const correct = `[[${a+1},${b+1}],[${c+1},${d+1}]]`;
    const options = shuffle([
      correct,
      `[[${a+1},${b}],[${c},${d+1}]]`,
      `[[${a},${b}],[${c},${d}]]`,
      `[[${a+2},${b+2}],[${c+2},${d+2}]]`
    ]);
    return { prompt, correct, options, hint: "Dica: some termo a termo.", skillId: "em3_matrices", errorType: "E_CONCEPT" };
  }

  function genComplex() {
    const a = randInt(1, 6);
    const b = randInt(1, 6);
    const prompt = `Se z = ${a} + ${b}i, então o conjugado de z é:`;
    const correct = `${a} − ${b}i`;
    const options = shuffle([correct, `${a} + ${b}i`, `${-a} − ${b}i`, `${a} − ${b+1}i`]);
    return { prompt, correct, options, hint: "Dica: o conjugado troca o sinal da parte imaginária.", skillId: "em3_complex", errorType: "E_CONCEPT" };
  }

  function genLimits() {
    const a = randInt(1, 8);
    const prompt = `Intuição: quando x se aproxima de ${a}, o valor de (x + 2) se aproxima de:`;
    const correct = a + 2;
    return makeMCQ(prompt, String(correct), numDistractors(correct, 6).map(String), "Dica: substitua o valor bem perto de x.", { skillId: "em3_limits", errorType: "E_CONCEPT" });
  }

  // OBMEP-like (não copia questões oficiais; apenas estilo)
  function genObPatterns() {
    const start = randInt(1, 5);
    const step = randInt(2, 5);
    const n3 = start + step * 2;
    const n4 = start + step * 3;
    const prompt = `Complete o padrão: ${start}, ${start+step}, ${n3}, __`;
    return makeMCQ(prompt, String(n4), numDistractors(n4, 10).map(String), "Dica: observe a variação entre os termos.", { skillId: "ob_patterns", errorType: "E_CONCEPT" });
  }

  function genObParity() {
    const n = randInt(10, 99);
    const prompt = `Se ${n} é ${n % 2 === 0 ? "par" : "ímpar"}, então ${n} + 1 é:`;
    const correct = (n + 1) % 2 === 0 ? "par" : "ímpar";
    const options = shuffle([correct, correct === "par" ? "ímpar" : "par", "par", "ímpar"]).slice(0,4);
    return { prompt, correct, options, hint: "Dica: par + 1 vira ímpar; ímpar + 1 vira par.", skillId: "ob_parity", errorType: "E_CONCEPT" };
  }

  function genObCounting() {
    const a = randInt(2, 5);
    const b = randInt(2, 5);
    const c = randInt(2, 5);
    const correct = a * b * c;
    const prompt = `Quantas combinações existem ao escolher 1 item de cada grupo: ${a} opções, ${b} opções e ${c} opções?`;
    return makeMCQ(prompt, String(correct), numDistractors(correct, 12).map(String), "Dica: multiplique as quantidades de opções.", { skillId: "ob_counting", errorType: "E_CONCEPT" });
  }

  // Mapa de skillId -> generator
  const GEN = {
    g1_count_succ: genCountingSucc,
    g1_add_10: () => Object.assign(genAdd(10), { skillId: "g1_add_10" }),
    g1_sub_10: () => Object.assign(genSub(10), { skillId: "g1_sub_10" }),
    g1_patterns: () => Object.assign(genObPatterns(), { skillId: "g1_patterns" }),

    g2_place_value: genPlaceValue,
    g2_add_100: () => Object.assign(genAdd(100), { skillId: "g2_add_100" }),
    g2_sub_100: () => Object.assign(genSub(100), { skillId: "g2_sub_100" }),
    g2_mul_groups: genMulGroups,

    g3_mul_facts_2_5: () => Object.assign(genMulFacts(2, 5), { skillId: "g3_mul_facts_2_5" }),
    g3_div_sharing: () => Object.assign(genDivSharing(), { skillId: "g3_div_sharing" }),
    g3_frac_halves: () => Object.assign(genFracHalves(), { skillId: "g3_frac_halves" }),
    g3_area_rect: () => Object.assign(genAreaRect(), { skillId: "g3_area_rect" }),

    g4_mul_facts_6_9: () => Object.assign(genMulFacts(6, 9), { skillId: "g4_mul_facts_6_9" }),
    g4_mul_2digit: () => {
      const a = randInt(10, 99);
      const b = randInt(2, 9);
      const correct = a * b;
      return makeMCQ(`${a} × ${b} = ?`, String(correct), numDistractors(correct, 40).map(String), "Dica: decomponha (ex.: 23×4 = 20×4 + 3×4).", { skillId: "g4_mul_2digit", errorType: "E_PROC" });
    },
    g4_frac_equiv: () => Object.assign(genFracEquiv(), { skillId: "g4_frac_equiv" }),
    g4_decimals_01: () => Object.assign(genDecimals01(), { skillId: "g4_decimals_01" }),

    g5_div_2digit: () => {
      const b = randInt(2, 9);
      const q = randInt(2, 20);
      const a = b * q;
      const correct = q;
      return makeMCQ(`${a} ÷ ${b} = ?`, String(correct), numDistractors(correct, 8).map(String), "Dica: pense na tabuada inversa.", { skillId: "g5_div_2digit", errorType: "E_FACT" });
    },
    g5_frac_add_like: () => {
      const d = [2,3,4,5,6,8,10][randInt(0,6)];
      const n1 = randInt(1, d-1);
      const n2 = randInt(1, d-1);
      const correct = fractionStr(n1+n2, d);
      const prompt = `Some: ${fractionStr(n1,d)} + ${fractionStr(n2,d)}`;
      const options = shuffle([correct, fractionStr(n1+n2, d+1), fractionStr(n1, d), fractionStr(n2, d)]);
      return { prompt, correct, options, hint: "Dica: com denominador igual, some os numeradores.", skillId: "g5_frac_add_like", errorType: "E_CONCEPT" };
    },
    g5_dec_addsub: () => {
      const a = (randInt(10, 99)/10).toFixed(1);
      const b = (randInt(10, 99)/10).toFixed(1);
      const op = Math.random()<0.5 ? "+" : "−";
      const correct = (op === "+") ? (Number(a)+Number(b)) : (Number(a)-Number(b));
      return makeMCQ(`${a} ${op} ${b} = ?`, String(correct.toFixed(1).replace(".0","")), numDistractors(Math.round(correct*10)/10, 5).map(v=>String(v)), "Dica: alinhe as vírgulas.", { skillId: "g5_dec_addsub", errorType: "E_PLACE" });
    },
    g5_percent_intro: () => {
      const base = [20,40,60,80,100][randInt(0,4)];
      const p = [10, 50][randInt(0,1)];
      const correct = base * p / 100;
      return makeMCQ(`${p}% de ${base} = ?`, String(correct), numDistractors(correct, 15).map(String), "Dica: 10% é dividir por 10; 50% é a metade.", { skillId: "g5_percent_intro", errorType: "E_CONCEPT" });
    },

    g6_order_ops: genOrderOps,
    g6_dec_compare: genDecimalsCompare,
    g6_frac_equiv: () => Object.assign(genFracEquiv(), { skillId: "g6_frac_equiv" }),
    g6_percent_simple: genPercentSimple,

    g7_int_ops: genIntegersOps,
    g7_prop: genProp,
    g7_eq_1step: genEq1Step,
    g7_area: genAreaRect,

    g8_algebra_simplify: genAlgebraSimplify,
    g8_eq_linear: genEqLinear,
    g8_functions_intro: genFunctionEval,
    g8_powers: genPowers,

    g9_systems: genSystems,
    g9_quadratic: genQuadratic,
    g9_similarity: genSimilarity,
    g9_probability: genProbability,

    em1_functions: genFunctionEval,
    em1_factor: genQuadratic,
    em1_trig: () => {
      const hyp = [5, 10, 13][randInt(0,2)];
      const prompt = `Em um triângulo retângulo, a hipotenusa mede ${hyp}. Um cateto mede ${hyp-1}. Qual é o outro cateto? (use Pitágoras)`;
      const correct = Math.round(Math.sqrt(hyp*hyp - (hyp-1)*(hyp-1)));
      return makeMCQ(prompt, String(correct), numDistractors(correct, 5).map(String), "Dica: a²=b²+c².", { skillId: "em1_trig", errorType: "E_CONCEPT" });
    },
    em1_stats: genStats,

    em2_exp_log: genExpLog,
    em2_seq: genSeq,
    em2_comb: genComb,
    em2_geo_analytic: genGeoAnalytic,

    em3_prob: genProbability,
    em3_matrices: genMatrices,
    em3_complex: genComplex,
    em3_limits: genLimits,

    ob_patterns: genObPatterns,
    ob_parity: genObParity,
    ob_counting: genObCounting,
  };

  function skillTitle(skillId) {
    return (SKILL_META[skillId] && SKILL_META[skillId].title) ? SKILL_META[skillId].title : skillId;
  }

  /* =========================
     State
     ========================= */

  const UI = {
    mode: "rapid", // "rapid" | "study"
    practice: { noTimer: false },
  };

  let activeProfileId = null;
  let profiles = [];
  let progress = null; // progress do perfil ativo
  let currentSession = null; // sessão em andamento

  function defaultSettings() {
    return {
      noTimer: false,
      readingEasy: false,
      focusMode: false,
      reduceMotion: false,
      voice: false,
      libras: false,
      inclusionPack: false,
    };
  }

  function newProgressForProfile(p) {
    const nowIso = new Date().toISOString();
    return {
      schema: "local_progress",
      schemaVersion: "local1",
      profileId: p.profileId,
      student: {
        firstName: p.firstName,
        gradeYear: p.gradeYear,
        classGroup: p.classGroup,
      },
      school: { name: p.schoolName },
      startEntry: p.startEntry,           // 1 ou 6
      currentYearTrack: trackKeyFromGrade(p.startEntry),
      xp: 0,
      coins: 0,
      streak: { current: 0, best: 0, lastActiveDate: null, freezes: 0 },
      history: { totalSessions: 0, totalMinutes: 0, firstSeenAt: nowIso, lastActiveAt: null, weeklyActiveDays: 0 },
      settings: defaultSettings(),
      units: {},  // nodeId -> record
      skills: {}, // skillId -> record
      errors: { byType: {}, recent: [] },
      weekly: {}, // weekKey -> progress
    };
  }

  function ensureSkill(skillId) {
    if (!progress.skills[skillId]) {
      progress.skills[skillId] = {
        mastery: 45,
        correct: 0,
        wrong: 0,
        avgTimeSec: null,
        stage: 0,
        nextReviewAt: null,
        lastSeenAt: null,
      };
    }
    return progress.skills[skillId];
  }

  function loadProfiles() {
    profiles = load(APP.storage.profiles, []);
    activeProfileId = localStorage.getItem(APP.storage.activeProfileId);
  }

  function saveProfiles() {
    save(APP.storage.profiles, profiles);
    if (activeProfileId) localStorage.setItem(APP.storage.activeProfileId, activeProfileId);
  }

  function loadProgress(profileId) {
    const key = APP.storage.progressPrefix + profileId;
    const p = load(key, null);
    return p;
  }

  function saveProgress() {
    if (!progress || !progress.profileId) return;
    save(APP.storage.progressPrefix + progress.profileId, progress);
  }

  function setActiveProfile(profileId) {
    activeProfileId = profileId;
    localStorage.setItem(APP.storage.activeProfileId, profileId);
    progress = loadProgress(profileId);
    if (!progress) {
      const p = profiles.find(x => x.profileId === profileId);
      progress = newProgressForProfile(p);
      saveProgress();
    }
    applyStreakRules();
    syncSettingsUI();
    renderHomeProfile();
  }

  function deleteProfile(profileId) {
    profiles = profiles.filter(p => p.profileId !== profileId);
    saveProfiles();
    localStorage.removeItem(APP.storage.progressPrefix + profileId);
    if (activeProfileId === profileId) {
      activeProfileId = null;
      localStorage.removeItem(APP.storage.activeProfileId);
      progress = null;
    }
  }

  /* =========================
     Streak / Freeze
     ========================= */

  function applyStreakRules() {
    if (!progress) return;
    const s = progress.streak;
    const today = todayKey();

    if (!s.lastActiveDate) return;

    const days = diffDays(s.lastActiveDate, today);
    if (days <= 0) return;

    if (days === 1) {
      // ok: ontem foi o último dia
      return;
    }

    // dias perdidos: precisa de freeze para cada dia sem prática
    const missed = days - 1;
    const canCover = Math.min(missed, s.freezes || 0);
    if (canCover > 0) {
      s.freezes -= canCover;
      toast(`🧊 Usei ${canCover} bloqueio(s) para proteger sua ofensiva.`);
      // continua streak
      saveProgress();
    }
    if (missed > canCover) {
      s.current = 0;
      toast("Sua ofensiva zerou por falta de prática. Vamos retomar hoje!");
      saveProgress();
    }
  }

  function markPracticedToday(minutesSpent) {
    if (!progress) return;
    const s = progress.streak;
    const today = todayKey();
    const last = s.lastActiveDate;

    if (!last) {
      s.current = 1;
      s.best = Math.max(s.best, s.current);
    } else {
      const days = diffDays(last, today);
      if (days === 0) {
        // já contou hoje
      } else if (days === 1) {
        s.current += 1;
        s.best = Math.max(s.best, s.current);
      } else if (days > 1) {
        // applyStreakRules já tenta proteger; aqui é o dia de retorno
        if (s.current === 0) s.current = 1;
        else s.current += 1;
        s.best = Math.max(s.best, s.current);
      }
    }
    s.lastActiveDate = today;

    progress.history.totalMinutes += Math.max(0, minutesSpent || 0);
    progress.history.lastActiveAt = new Date().toISOString();
    saveProgress();
    renderHomeProfile();
  }

  /* =========================
     Mastery / SR / Errors
     ========================= */

  function updateMastery(skillId, isCorrect, difficultyTag) {
    const sk = ensureSkill(skillId);
    const baseGain = difficultyTag === "hard" ? 4 : (difficultyTag === "easy" ? 2 : 3);
    const baseLoss = difficultyTag === "hard" ? 6 : (difficultyTag === "easy" ? 4 : 5);

    if (isCorrect) {
      sk.correct += 1;
      sk.mastery = clamp(sk.mastery + baseGain, 0, 100);
    } else {
      sk.wrong += 1;
      sk.mastery = clamp(sk.mastery - baseLoss, 0, 100);
    }
    sk.lastSeenAt = new Date().toISOString();

    // Atualiza SR (leve): avança estágio se acerto; recua se erro
    if (isCorrect) {
      sk.stage = clamp(sk.stage + 1, 0, APP.srIntervalsDays.length);
    } else {
      sk.stage = clamp(sk.stage - 1, 0, APP.srIntervalsDays.length);
    }
    const days = APP.srIntervalsDays[clamp(sk.stage - 1, 0, APP.srIntervalsDays.length - 1)] || 1;
    const next = new Date();
    next.setDate(next.getDate() + days);
    sk.nextReviewAt = next.toISOString();
  }

  function recordError(errorType, skillId) {
    if (!progress) return;
    const key = errorType || "E_OTHER";
    progress.errors.byType[key] = (progress.errors.byType[key] || 0) + 1;
    progress.errors.recent.unshift({
      at: new Date().toISOString(),
      errorType: key,
      skillId: skillId || null,
    });
    progress.errors.recent = progress.errors.recent.slice(0, 50);
  }

  function srDueSkills(limit = 6) {
    if (!progress) return [];
    const now = Date.now();
    const arr = Object.entries(progress.skills)
      .map(([skillId, sk]) => ({ skillId, sk }))
      .filter(x => x.sk.nextReviewAt && new Date(x.sk.nextReviewAt).getTime() <= now)
      .sort((a, b) => new Date(a.sk.nextReviewAt).getTime() - new Date(b.sk.nextReviewAt).getTime());
    return arr.slice(0, limit).map(x => x.skillId);
  }

  function weakestSkillsInTrack(trackKey, limit = 2) {
    const prefix = trackKey + "_";
    const arr = Object.entries(progress.skills)
      .filter(([skillId]) => skillId.startsWith(prefix))
      .map(([skillId, sk]) => ({ skillId, mastery: sk.mastery, attempts: (sk.correct + sk.wrong) }))
      .filter(x => x.attempts >= 3)
      .sort((a, b) => a.mastery - b.mastery);
    return arr.slice(0, limit).map(x => x.skillId);
  }

  /* =========================
     Session Builder
     ========================= */

  function baseTimeFor(difficulty) {
    if (difficulty === "easy") return 15;
    if (difficulty === "hard") return 45;
    return 30;
  }

  function makeSession({ sessionType, node, topicSkillIds, questionCount, difficulty, noTimerOverride }) {
    const now = Date.now();
    const trackKey = progress ? progress.currentYearTrack : "g6";

    const target = topicSkillIds && topicSkillIds.length ? topicSkillIds : (node ? node.skillIds : []);
    const due = srDueSkills(Math.max(1, Math.floor(questionCount * 0.2)));
    const weak = weakestSkillsInTrack(trackKey, Math.max(1, Math.floor(questionCount * 0.1)));

    // 70/20/10: alvo / SR / fracos
    const plan = [];
    const nTarget = Math.max(1, Math.floor(questionCount * 0.7));
    const nDue = Math.max(0, Math.floor(questionCount * 0.2));
    const nWeak = Math.max(0, questionCount - nTarget - nDue);

    for (let i = 0; i < nTarget; i++) plan.push(target[i % target.length]);
    for (let i = 0; i < nDue && due.length; i++) plan.push(due[i % due.length]);
    for (let i = 0; i < nWeak && weak.length; i++) plan.push(weak[i % weak.length]);

    shuffle(plan);

    const questions = plan.map(skillId => {
      const gen = GEN[skillId] || GEN["g6_order_ops"];
      const q = gen();
      q.skillId = q.skillId || skillId;
      q.difficulty = difficulty;
      q.sessionType = sessionType;
      return q;
    });

    const noTimer = Boolean(noTimerOverride) || progress.settings.noTimer || (UI.mode === "study");
    const timerOn = !noTimer;

    const base = baseTimeFor(difficulty);
    const sessionBaseTime = sessionType === "B" ? base : (sessionType === "R" ? Math.max(12, base - 5) : Math.max(10, base - 8));

    return {
      id: `s_${now}`,
      startedAt: new Date().toISOString(),
      sessionType, // "L"|"R"|"B"|"P"|"SR"|"E"|"W"
      nodeId: node ? node.nodeId : null,
      trackKey,
      difficulty,
      timerOn,
      sessionBaseTime,
      timeMultiplier: 1,
      questions,
      idx: 0,
      correct: 0,
      wrong: 0,
      earnedXp: 0,
      earnedCoins: 0,
      stats: { perSkill: {} },
    };
  }

  function startNodeSession(node) {
    if (!progress) { toast("Crie/seleciona um perfil antes."); showScreen("profiles-screen"); return; }
    const sessionType = node.type; // L/R/B
    const questionCount = progress.settings.focusMode ? (sessionType === "B" ? 8 : 6) : (sessionType === "B" ? 10 : (sessionType === "R" ? 6 : 8));
    const difficulty = "mid";
    currentSession = makeSession({ sessionType, node, questionCount, difficulty });
    openSession();
  }

  function startPracticeSession(topicKey, difficulty, count, noTimer) {
    if (!progress) { toast("Crie/seleciona um perfil antes."); showScreen("profiles-screen"); return; }

    // mapeia practice topics para skillIds existentes
    let skillIds;
    switch (topicKey) {
      case "add": skillIds = ["g2_add_100"]; break;
      case "sub": skillIds = ["g2_sub_100"]; break;
      case "mul": skillIds = ["g4_mul_facts_6_9"]; break;
      case "div": skillIds = ["g5_div_2digit"]; break;
      case "decimals_compare": skillIds = ["g6_dec_compare"]; break;
      case "fractions_equiv": skillIds = ["g6_frac_equiv"]; break;
      case "percent_simple": skillIds = ["g6_percent_simple"]; break;
      case "order_ops": skillIds = ["g6_order_ops"]; break;
      case "ob_patterns": skillIds = ["ob_patterns"]; break;
      case "ob_parity": skillIds = ["ob_parity"]; break;
      case "ob_counting": skillIds = ["ob_counting"]; break;
      default: skillIds = ["g4_mul_facts_6_9"]; break;
    }
    currentSession = makeSession({ sessionType: "P", topicSkillIds: skillIds, questionCount: count, difficulty, noTimerOverride: noTimer });
    openSession();
  }

  function startSRSession() {
    if (!progress) { toast("Crie/seleciona um perfil antes."); showScreen("profiles-screen"); return; }
    const due = srDueSkills(12);
    if (!due.length) {
      toast("Nenhuma revisão vencida agora. Volte mais tarde 🙂");
      return;
    }
    currentSession = makeSession({ sessionType: "SR", topicSkillIds: due, questionCount: Math.min(8, due.length), difficulty: "mid" });
    currentSession.timerOn = false; // SR sem tempo por padrão
    openSession();
  }

  function startErrorTraining() {
    if (!progress) return;
    // pega skills mais erradas recentemente
    const recent = progress.errors.recent.slice(0, 30);
    const countBySkill = {};
    recent.forEach(e => {
      if (!e.skillId) return;
      countBySkill[e.skillId] = (countBySkill[e.skillId] || 0) + 1;
    });
    const top = Object.entries(countBySkill).sort((a,b)=>b[1]-a[1]).slice(0, 3).map(x=>x[0]);
    if (!top.length) {
      toast("Sem erros registrados ainda. Isso é ótimo!");
      return;
    }
    currentSession = makeSession({ sessionType: "E", topicSkillIds: top, questionCount: 5, difficulty: "easy", noTimerOverride: progress.settings.noTimer || true });
    currentSession.timerOn = false;
    openSession();
  }

  function startWeeklyWarmup() {
    if (!progress) { toast("Crie/seleciona um perfil antes."); showScreen("profiles-screen"); return; }
    const theme = weeklyThemeForNow().themeKey;
    const skillIds = theme === "patterns" ? ["ob_patterns"] : (theme === "parity" ? ["ob_parity"] : ["ob_counting"]);
    currentSession = makeSession({ sessionType: "W", topicSkillIds: skillIds, questionCount: 3, difficulty: "mid" });
    currentSession.timerOn = false;
    openSession();
  }

  function startWeeklyBoss() {
    if (!progress) { toast("Crie/seleciona um perfil antes."); showScreen("profiles-screen"); return; }
    const theme = weeklyThemeForNow().themeKey;
    const skillIds = theme === "patterns" ? ["ob_patterns"] : (theme === "parity" ? ["ob_parity"] : ["ob_counting"]);
    currentSession = makeSession({ sessionType: "W", topicSkillIds: skillIds, questionCount: 8, difficulty: "hard" });
    // Boss semanal: timer depende do modo
    currentSession.timerOn = !(progress.settings.noTimer || UI.mode === "study");
    openSession();
  }

  /* =========================
     Session UI / Timer
     ========================= */

  const els = {};

  let timer = {
    running: false,
    totalSec: 0,
    remainingSec: 0,
    handle: null,
    startedAt: null,
  };

  function cacheEls() {
    els.activeProfileLine = $("active-profile-line");
    els.activeStreakLine = $("active-streak-line");

    els.profilesList = $("profiles-list");
    els.profileForm = $("profile-form");
    els.pfFirstName = $("pf-firstName");
    els.pfGradeYear = $("pf-gradeYear");
    els.pfClassGroup = $("pf-classGroup");
    els.pfSchoolName = $("pf-schoolName");

    els.trackLine = $("track-line");
    els.trackSubline = $("track-subline");
    els.trackYearSelect = $("track-year-select");
    els.mapList = $("map-list");

    els.practiceTopic = $("practice-topic");
    els.practiceDiff = $("practice-difficulty");
    els.practiceCount = $("practice-count");

    els.errorsSummary = $("errors-summary");

    els.hudXp = $("hud-xp");
    els.hudCoins = $("hud-coins");
    els.hudQ = $("hud-q");
    els.sessionTag = $("session-tag");
    els.sessionTimerPill = $("session-timer-pill");
    els.timeBar = $("time-bar");
    els.questionText = $("question-text");
    els.hintArea = $("hint-area");
    els.answerOptions = $("answer-options");
    els.btnHint = $("btn-hint");
    els.btnToggleTimer = $("btn-toggle-timer");
    els.btnTts = $("btn-tts");

    els.resultTitle = $("result-title");
    els.resultStats = $("result-stats");
    els.resultNext = $("result-next");

    els.freezePrice = $("freeze-price");
    els.btnBuyFreeze = $("btn-buy-freeze");

    els.weeklyWeekKey = $("weekly-weekkey");
    els.weeklyTheme = $("weekly-theme");
    els.weeklyStatus = $("weekly-status");

    // Teacher
    els.teacherImport = $("teacher-import");
    els.teacherSchoolSelect = $("teacher-school-select");
    els.teacherClassSelect = $("teacher-class-select");
    els.teacherTableWrap = $("teacher-table-wrap");
    els.teacherReportWrap = $("teacher-report-wrap");
    els.teacherReportText = $("teacher-report-text");
  }

  function renderHomeProfile() {
    if (!els.activeProfileLine) return;
    if (!progress) {
      els.activeProfileLine.textContent = "Nenhum perfil selecionado";
      els.activeStreakLine.textContent = "";
      return;
    }
    const p = progress.student;
    const s = progress.streak;
    const trackLabel = trackLabelFromKey(progress.currentYearTrack);
    els.activeProfileLine.textContent = `${p.firstName} • ${gradeLabel(p.gradeYear)} • ${p.classGroup} • ${progress.school.name}`;
    els.activeStreakLine.textContent = `🔥 Ofensiva: ${s.current} (recorde ${s.best}) • 🧊 Bloqueios: ${s.freezes} • 🗺️ Trilha: ${trackLabel}`;
  }

  function trackLabelFromKey(trackKey) {
    if (trackKey.startsWith("g")) return `${trackKey.slice(1)}º ano`;
    if (trackKey === "em1") return "1º EM";
    if (trackKey === "em2") return "2º EM";
    if (trackKey === "em3") return "3º EM";
    return trackKey;
  }

  function syncSettingsUI() {
    if (!progress) return;
    const s = progress.settings;
    $("set-no-timer").checked = !!s.noTimer;
    $("set-reading-easy").checked = !!s.readingEasy;
    $("set-focus-mode").checked = !!s.focusMode;
    $("set-reduce-motion").checked = !!s.reduceMotion;
    $("set-voice").checked = !!s.voice;
    $("set-libras").checked = !!s.libras;

    // botões da home
    setToggleButtonState($("toggle-voice-read"), s.voice);
    setToggleButtonState($("toggle-libras"), s.libras);
    setToggleButtonState($("toggle-focus-mode"), s.focusMode);
    setToggleButtonState($("toggle-reading-easy"), s.readingEasy);

    // modo
    if (UI.mode === "rapid") {
      $("mode-rapido").classList.add("btn-primary");
      $("mode-rapido").classList.remove("btn-secondary");
      $("mode-estudo").classList.add("btn-secondary");
      $("mode-estudo").classList.remove("btn-primary");
    } else {
      $("mode-estudo").classList.add("btn-primary");
      $("mode-estudo").classList.remove("btn-secondary");
      $("mode-rapido").classList.add("btn-secondary");
      $("mode-rapido").classList.remove("btn-primary");
    }
  }

  function setToggleButtonState(btn, on) {
    if (!btn) return;
    btn.classList.toggle("btn-primary", !!on);
    btn.classList.toggle("btn-secondary", !on);
  }

  function renderProfiles() {
    els.profilesList.innerHTML = "";
    if (!profiles.length) {
      els.profilesList.innerHTML = `<div class="muted">Nenhum perfil ainda. Crie abaixo.</div>`;
      return;
    }
    profiles.forEach(p => {
      const div = document.createElement("div");
      div.className = "profile-card";
      const isActive = (p.profileId === activeProfileId);
      div.innerHTML = `
        <div>
          <div class="name">${escapeHtml(p.firstName)} ${isActive ? "• (ativo)" : ""}</div>
          <div class="meta">${gradeLabel(p.gradeYear)} • ${escapeHtml(p.classGroup)} • ${escapeHtml(p.schoolName)}</div>
          <div class="meta">Entrada: ${p.startEntry === 6 ? "6º ano" : "1º ano"}</div>
        </div>
        <div class="actions">
          <button class="${isActive ? "btn-secondary" : "btn-primary"}" data-act="select" data-id="${p.profileId}">Entrar</button>
          <button class="btn-secondary" data-act="delete" data-id="${p.profileId}">Excluir</button>
        </div>
      `;
      els.profilesList.appendChild(div);
    });
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /* =========================
     Map / Progress
     ========================= */

  function nodeRecord(nodeId) {
    if (!progress.units[nodeId]) {
      progress.units[nodeId] = { attempts: 0, bestScore: 0, passed: false, stars: 0, lastAttemptAt: null };
    }
    return progress.units[nodeId];
  }

  function unitCompletion(trackKey, unit) {
    const bossId = `${unit.unitId}_b1`;
    const r = progress.units[bossId];
    return r && r.passed;
  }

  function isNodeUnlocked(trackKey, unitIdx, node) {
    // regra simples: unidades em sequência (boss passado para abrir próxima)
    if (unitIdx === 0) return true;
    const prevUnit = TRACKS[trackKey].units[unitIdx - 1];
    const prevBossId = `${prevUnit.unitId}_b1`;
    const prevBoss = progress.units[prevBossId];
    return !!(prevBoss && prevBoss.passed);
  }

  function renderMap() {
    if (!progress) return;
    const trackKey = progress.currentYearTrack;
    const track = TRACKS[trackKey] || TRACKS["g6"];
    els.trackLine.textContent = `${trackLabelFromKey(trackKey)} • ${progress.student.firstName}`;
    els.trackSubline.textContent = `Passe os chefões com pelo menos ${Math.round(APP.passScore*100)}%.`;

    // year selector options
    els.trackYearSelect.innerHTML = "";
    Object.keys(TRACKS).forEach(k => {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = trackLabelFromKey(k);
      if (k === trackKey) opt.selected = true;
      els.trackYearSelect.appendChild(opt);
    });

    els.mapList.innerHTML = "";
    track.units.forEach((unit, idx) => {
      const unlocked = isNodeUnlocked(trackKey, idx, unit.nodes[0]);
      const done = unitCompletion(trackKey, unit);

      const card = document.createElement("div");
      card.className = "unit-card";
      const subSkills = unit.skillIds.map(skillTitle).join(" • ");

      const statusText = done ? "Concluído" : (unlocked ? "Disponível" : "Travado");
      const statusDot = done ? "dot-done" : (unlocked ? "dot-open" : "dot-locked");

      card.innerHTML = `
        <div class="unit-head">
          <div>
            <div class="unit-title">${escapeHtml(unit.title)}</div>
            <div class="unit-sub">${escapeHtml(subSkills)}</div>
          </div>
          <div class="pill"><span class="dot ${statusDot}"></span> ${statusText}</div>
        </div>
        <div class="node-row" id="node-row-${unit.unitId}"></div>
      `;

      els.mapList.appendChild(card);

      const row = card.querySelector(`#node-row-${unit.unitId}`);
      unit.nodes.forEach(n => {
        const rec = progress.units[n.nodeId];
        const passed = rec && rec.passed;
        const btn = document.createElement("button");
        btn.className = "node-btn";
        btn.textContent = n.type === "B" ? "Chefão" : (n.type === "R" ? "Revisão" : n.title);
        btn.dataset.nodeId = n.nodeId;
        if (passed) btn.classList.add("done");
        if (unlocked) btn.classList.add("open");
        btn.disabled = !unlocked && !passed;
        btn.addEventListener("click", () => {
          const nodeObj = n;
          startNodeSession(nodeObj);
        });
        row.appendChild(btn);
      });
    });

    // errors summary
    renderErrorsSummary();
  }

  function renderErrorsSummary() {
    if (!progress) return;
    const byType = progress.errors.byType || {};
    const top = Object.entries(byType).sort((a,b)=>b[1]-a[1])[0];
    if (!top) {
      els.errorsSummary.textContent = "Sem erros registrados ainda. Continue praticando!";
      return;
    }
    const [type, count] = top;
    els.errorsSummary.textContent = `Erro mais frequente: ${type} (${count}). Use “Treinar erros” para melhorar rápido.`;
  }

  /* =========================
     Session runner
     ========================= */

  function openSession() {
    if (!currentSession) return;

    // HUD
    els.hudXp.textContent = String(progress.xp);
    els.hudCoins.textContent = String(progress.coins);

    // Tag
    els.sessionTag.textContent = sessionTagLabel(currentSession.sessionType);
    updateTimerButtonLabel();

    showScreen("session-screen");
    renderQuestion();
  }

  function sessionTagLabel(t) {
    switch (t) {
      case "L": return "Lição";
      case "R": return "Revisão";
      case "B": return "Chefão (80%)";
      case "P": return "Prática";
      case "SR": return "Revisão (SR)";
      case "E": return "Treino de erros";
      case "W": return "Evento semanal";
      default: return "Sessão";
    }
  }

  function updateTimerButtonLabel() {
    const on = !!currentSession.timerOn;
    els.btnToggleTimer.textContent = `⏱️ Tempo: ${on ? "ON" : "OFF"}`;
    els.sessionTimerPill.textContent = on ? "⏱️" : "⏱️ OFF";
  }

  function renderQuestion() {
    stopTimer();

    const q = currentSession.questions[currentSession.idx];
    if (!q) {
      finishSession();
      return;
    }

    els.hudQ.textContent = `${currentSession.idx + 1}/${currentSession.questions.length}`;

    // Leitura fácil (reduz texto)
    const prompt = formatPrompt(q.prompt, progress.settings.readingEasy);
    els.questionText.textContent = prompt;

    els.hintArea.classList.add("hidden");
    els.hintArea.textContent = "";

    // Options
    els.answerOptions.innerHTML = "";
    q.options.forEach(opt => {
      const b = document.createElement("button");
      b.className = "option-btn";
      b.type = "button";
      b.textContent = String(opt);
      b.addEventListener("click", () => onAnswer(opt, b));
      els.answerOptions.appendChild(b);
    });

    // TTS auto (opcional)
    if (progress.settings.voice) {
      speak(prompt);
    }

    // Timer
    if (currentSession.timerOn) {
      const total = currentSession.sessionBaseTime * currentSession.timeMultiplier;
      startTimer(total);
    } else {
      // mantém barra cheia
      els.timeBar.style.transform = "scaleX(1)";
    }
  }

  function formatPrompt(prompt, readingEasy) {
    if (!readingEasy) return prompt;
    // leitura fácil: reduz frases, remove parênteses longos
    let p = String(prompt);
    p = p.replace(/\s+/g, " ").trim();
    if (p.length > 110) p = p.slice(0, 110) + "…";
    return p;
  }

  function onAnswer(selected, btnEl) {
    const q = currentSession.questions[currentSession.idx];
    if (!q) return;

    // trava cliques múltiplos
    const buttons = Array.from(els.answerOptions.querySelectorAll("button"));
    buttons.forEach(b => b.disabled = true);

    stopTimer();

    const isCorrect = String(selected) === String(q.correct);
    if (isCorrect) {
      btnEl.classList.add("correct");
      currentSession.correct += 1;
      currentSession.timeMultiplier = 1; // volta ao normal ao acertar

      const xpGain = calcXp(q, true);
      const coinGain = calcCoins(q, true);
      currentSession.earnedXp += xpGain;
      currentSession.earnedCoins += coinGain;

      progress.xp += xpGain;
      progress.coins += coinGain;

      updateMastery(q.skillId, true, q.difficulty);

    } else {
      btnEl.classList.add("wrong");
      currentSession.wrong += 1;
      // desafio: ao errar, diminui um pouco o tempo (apenas se timer estiver on)
      if (currentSession.timerOn) {
        currentSession.timeMultiplier = clamp(currentSession.timeMultiplier * 0.85, 0.60, 1);
      }

      // marca a correta
      buttons.forEach(b => {
        if (String(b.textContent) === String(q.correct)) b.classList.add("correct");
      });

      const xpGain = calcXp(q, false);
      const coinGain = calcCoins(q, false);
      currentSession.earnedXp += xpGain;
      currentSession.earnedCoins += coinGain;

      progress.xp += xpGain;
      progress.coins += coinGain;

      updateMastery(q.skillId, false, q.difficulty);
      recordError(q.errorType || "E_OTHER", q.skillId);
    }

    saveProgress();
    els.hudXp.textContent = String(progress.xp);
    els.hudCoins.textContent = String(progress.coins);

    // próximo
    setTimeout(() => {
      currentSession.idx += 1;
      renderQuestion();
    }, progress.settings.reduceMotion ? 350 : 650);
  }

  function calcXp(q, correct) {
    const base = q.difficulty === "hard" ? 14 : (q.difficulty === "easy" ? 8 : 10);
    const bonus = (currentSession.sessionType === "B") ? 4 : 0;
    return correct ? (base + bonus) : Math.max(2, Math.floor(base * 0.25));
  }

  function calcCoins(q, correct) {
    const base = q.difficulty === "hard" ? 3 : (q.difficulty === "easy" ? 1 : 2);
    const bonus = (currentSession.sessionType === "B") ? 1 : 0;
    return correct ? (base + bonus) : 0;
  }

  function startTimer(totalSec) {
    timer.running = true;
    timer.totalSec = totalSec;
    timer.remainingSec = totalSec;
    timer.startedAt = performance.now();
    updateTimeBar();

    timer.handle = setInterval(() => {
      timer.remainingSec -= 0.05;
      if (timer.remainingSec <= 0) {
        timer.remainingSec = 0;
        updateTimeBar();
        stopTimer();
        onTimeout();
      } else {
        updateTimeBar();
        maybeAlert();
      }
    }, 50);
  }

  function updateTimeBar() {
    const ratio = timer.totalSec > 0 ? (timer.remainingSec / timer.totalSec) : 1;
    els.timeBar.style.transform = `scaleX(${clamp(ratio, 0, 1)})`;
  }

  function maybeAlert() {
    if (!progress.settings.libras) return;
    const ratio = timer.totalSec > 0 ? (timer.remainingSec / timer.totalSec) : 1;
    if (ratio < 0.22 && !maybeAlert._played) {
      maybeAlert._played = true;
      // som
      const snd = $("alert-sound");
      if (snd) {
        snd.currentTime = 0;
        snd.play().catch(()=>{});
      }
      // alerta visual
      const al = $("libras-alert");
      if (al) {
        al.classList.remove("hidden");
        setTimeout(() => al.classList.add("hidden"), 1500);
      }
    }
    if (ratio >= 0.22) maybeAlert._played = false;
  }

  function stopTimer() {
    if (timer.handle) clearInterval(timer.handle);
    timer.handle = null;
    timer.running = false;
    maybeAlert._played = false;
  }

  function onTimeout() {
    // marca como erro e segue
    const q = currentSession.questions[currentSession.idx];
    if (!q) return;
    recordError("E_TIME", q.skillId);
    updateMastery(q.skillId, false, q.difficulty);
    saveProgress();
    toast("⏳ Tempo esgotado.");
    // avança
    currentSession.idx += 1;
    renderQuestion();
  }

  function finishSession() {
    // registra node progress (se for node)
    const total = currentSession.questions.length;
    const score = total ? (currentSession.correct / total) : 0;
    const passed = score >= APP.passScore;

    if (currentSession.nodeId) {
      const rec = nodeRecord(currentSession.nodeId);
      rec.attempts += 1;
      rec.bestScore = Math.max(rec.bestScore || 0, score);
      rec.passed = rec.bestScore >= APP.passScore;
      rec.lastAttemptAt = new Date().toISOString();
      // estrelas
      rec.stars = rec.bestScore >= 0.93 ? 3 : (rec.bestScore >= 0.85 ? 2 : (rec.bestScore >= 0.80 ? 1 : 0));
    }

    // evento semanal
    if (currentSession.sessionType === "W") {
      const w = isoWeekKey();
      if (!progress.weekly[w]) progress.weekly[w] = { warmupDone: false, bossBestScore: 0, bossPassed: false, lastAt: null };
      const wk = progress.weekly[w];
      if (currentSession.questions.length <= 3) wk.warmupDone = true;
      else {
        wk.bossBestScore = Math.max(wk.bossBestScore, score);
        wk.bossPassed = wk.bossBestScore >= APP.passScore;
      }
      wk.lastAt = new Date().toISOString();
    }

    // atualiza histórico
    progress.history.totalSessions += 1;
    const estimatedMin = Math.max(1, Math.round(total * (currentSession.timerOn ? 0.6 : 0.9)));
    markPracticedToday(estimatedMin);

    saveProgress();

    // render resultado
    const type = currentSession.sessionType;
    const isBoss = (type === "B");
    const title = passed ? "✅ Você passou!" : "⚠️ Quase lá!";
    els.resultTitle.textContent = title;

    els.resultStats.innerHTML = `
      <div class="stat"><div class="k">Acertos</div><div class="v">${currentSession.correct}/${total}</div></div>
      <div class="stat"><div class="k">Pontuação</div><div class="v">${Math.round(score * 100)}%</div></div>
      <div class="stat"><div class="k">XP ganho</div><div class="v">+${currentSession.earnedXp}</div></div>
      <div class="stat"><div class="k">Moedas</div><div class="v">+${currentSession.earnedCoins}</div></div>
    `;

    els.resultNext.innerHTML = buildNextText(type, passed, score);

    // botões
    $("btn-result-retry").style.display = passed ? "none" : "inline-flex";
    $("btn-result-continue").textContent = passed ? "Continuar" : "Revisar e tentar";

    showScreen("result-screen");
  }

  function buildNextText(type, passed, score) {
    if (type === "B") {
      if (passed) return `<strong>Chefão concluído.</strong> Próxima unidade foi destravada.`;
      return `Para passar, você precisa de <strong>${Math.round(APP.passScore*100)}%</strong>. Sugestão: faça uma <strong>Revisão (SR)</strong> e tente novamente.`;
    }
    if (type === "W") {
      return passed ? "Evento concluído. Volte na próxima semana!" : "Faça o aquecimento e tente novamente.";
    }
    if (type === "SR") {
      return "Revisão feita. Isso melhora a memória e diminui erros no chefão.";
    }
    if (!passed) {
      return "Sugestão: treine seus erros (5 itens) e faça SR antes do próximo chefão.";
    }
    return "Ótimo! Continue avançando.";
  }

  /* =========================
     Result actions
     ========================= */

  function continueAfterResult() {
    if (!currentSession) { showScreen("home-screen"); return; }
    const t = currentSession.sessionType;
    const total = currentSession.questions.length;
    const score = total ? (currentSession.correct / total) : 0;
    const passed = score >= APP.passScore;

    if ((t === "B" || t === "L" || t === "R") && !passed) {
      // porta A: revisão guiada rápida
      startSRSession();
      return;
    }

    if (t === "P" || t === "SR" || t === "E" || t === "W") {
      // volta para tela origem
      showScreen("home-screen");
      return;
    }

    // volta pro mapa
    renderMap();
    showScreen("trails-screen");
  }

  function retryAfterResult() {
    if (!currentSession) return;
    // recomeça mesma sessão (mesmo node ou practice)
    const old = currentSession;
    if (old.nodeId) {
      // encontrar node a partir do track
      const track = TRACKS[old.trackKey];
      const node = track.units.flatMap(u => u.nodes).find(n => n.nodeId === old.nodeId);
      if (node) startNodeSession(node);
      return;
    }
    // prática: recria com os mesmos skills
    const skillIds = old.questions.map(q => q.skillId);
    currentSession = makeSession({ sessionType: old.sessionType, topicSkillIds: skillIds, questionCount: old.questions.length, difficulty: old.difficulty, noTimerOverride: !old.timerOn });
    currentSession.timerOn = old.timerOn;
    openSession();
  }

  /* =========================
     Weekly theme
     ========================= */

  function weeklyThemeForNow() {
    const wk = isoWeekKey();
    // ciclo simples de 3 temas
    const n = Number(wk.slice(-2));
    const idx = n % 3;
    const themeKey = idx === 0 ? "patterns" : (idx === 1 ? "parity" : "counting");
    const themeName = idx === 0 ? "Padrões" : (idx === 1 ? "Paridade" : "Contagem");
    return { weekKey: wk, themeKey, themeName };
  }

  function renderWeeklyScreen() {
    if (!progress) return;
    const info = weeklyThemeForNow();
    els.weeklyWeekKey.textContent = info.weekKey;
    els.weeklyTheme.textContent = `Tema: ${info.themeName}`;

    const wk = progress.weekly[info.weekKey];
    const done = wk && wk.bossPassed;
    els.weeklyStatus.textContent = done ? "Concluído" : "Disponível";
  }

  /* =========================
     Teacher panel
     ========================= */

  function teacherDbLoad() {
    return load(APP.storage.teacherDb, { students: {}, schools: {} });
  }

  function teacherDbSave(db) {
    save(APP.storage.teacherDb, db);
  }

  function validateExport(obj) {
    if (!obj || typeof obj !== "object") return { ok: false, msg: "Arquivo inválido." };
    if (obj.schema !== "progress_export") return { ok: false, msg: "Schema inválido (esperado progress_export)." };
    if (!obj.schemaVersion) return { ok: false, msg: "Faltou schemaVersion." };
    if (!obj.profileId) return { ok: false, msg: "Faltou profileId." };
    if (!obj.student || !obj.student.firstName || !obj.student.gradeYear || !obj.student.classGroup) return { ok: false, msg: "Faltam dados do estudante." };
    if (!obj.school || !obj.school.name) return { ok: false, msg: "Faltou nome da escola." };
    return { ok: true, msg: "OK" };
  }

  function computeMasteryJusto(skills) {
    const now = Date.now();
    const arr = Object.entries(skills || {}).map(([skillId, sk]) => {
      const attempts = (sk.correct || 0) + (sk.wrong || 0);
      const evidence = clamp(attempts / 20, 0.2, 1.0);
      let rec = 0.5;
      if (sk.lastSeenAt) {
        const days = (now - new Date(sk.lastSeenAt).getTime()) / 86400000;
        rec = days <= 7 ? 1.0 : (days <= 30 ? 0.7 : 0.5);
      }
      const w = evidence * rec;
      return { skillId, mastery: Number(sk.mastery ?? 0), attempts, w };
    });

    // cobertura: skills com attempts >=5
    const coverage = arr.filter(x => x.attempts >= 5).length;

    const filtered = arr.filter(x => x.attempts >= 5);
    const used = filtered.length >= 5 ? filtered : arr.filter(x => x.attempts >= 1);

    const sumW = used.reduce((s, x) => s + x.w, 0);
    if (!sumW) return { masteryJusto: 0, coverage };

    const val = used.reduce((s, x) => s + x.mastery * x.w, 0) / sumW;
    return { masteryJusto: Math.round(val), coverage };
  }

  function topDifficulties(skills, errors, limit = 2) {
    const byType = (errors && errors.byType) ? errors.byType : {};
    const now = Date.now();

    const arr = Object.entries(skills || {}).map(([skillId, sk]) => {
      const attempts = (sk.correct || 0) + (sk.wrong || 0);
      const evidence = clamp(attempts / 20, 0.2, 1.0);
      let rec = 0.5;
      if (sk.lastSeenAt) {
        const days = (now - new Date(sk.lastSeenAt).getTime()) / 86400000;
        rec = days <= 7 ? 1.0 : (days <= 30 ? 0.7 : 0.5);
      }
      const w = evidence * rec;
      const score = (100 - (sk.mastery ?? 0)) * w;
      return { skillId, mastery: sk.mastery ?? 0, score, attempts };
    }).filter(x => x.attempts >= 3).sort((a,b)=>b.score-a.score);

    return arr.slice(0, limit);
  }

  function unitsStatsFromExport(obj) {
    const units = obj.units || [];
    const unitKeys = new Set();
    const passedUnits = new Set();

    units.forEach(u => {
      if (!u.nodeId) return;
      const parts = u.nodeId.split("_");
      if (parts.length >= 2) {
        const unitKey = parts[0] + "_" + parts[1]; // ex: g6_u2
        unitKeys.add(unitKey);
        if (u.nodeId.endsWith("_b1") && u.passed) passedUnits.add(unitKey);
      }
    });

    const bossesTried = units.filter(u => u.nodeId && u.nodeId.endsWith("_b1") && (u.attempts || 0) >= 1).length;
    const bossesPassed = units.filter(u => u.nodeId && u.nodeId.endsWith("_b1") && !!u.passed).length;

    return {
      unitsSeen: unitKeys.size,
      unitsPassed: passedUnits.size,
      bossesTried,
      bossesPassed,
    };
  }

  function teacherImportFiles(files) {
    const db = teacherDbLoad();
    let imported = 0;

    const promises = Array.from(files).map(file => file.text().then(txt => {
      const obj = safeJsonParse(txt, null);
      const v = validateExport(obj);
      if (!v.ok) {
        toast(`Importação falhou: ${file.name} – ${v.msg}`);
        return;
      }

      const pid = obj.profileId;
      db.students[pid] = obj;
      imported++;

      const schoolName = obj.school.name;
      const classGroup = obj.student.classGroup;
      if (!db.schools[schoolName]) db.schools[schoolName] = {};
      if (!db.schools[schoolName][classGroup]) db.schools[schoolName][classGroup] = [];
      if (!db.schools[schoolName][classGroup].includes(pid)) db.schools[schoolName][classGroup].push(pid);
    }));

    Promise.all(promises).then(() => {
      teacherDbSave(db);
      toast(`Importados: ${imported} arquivo(s).`);
      renderTeacherSelectors();
      renderTeacherTable();
    });
  }

  function renderTeacherSelectors() {
    const db = teacherDbLoad();
    const schools = Object.keys(db.schools).sort();

    els.teacherSchoolSelect.innerHTML = "";
    if (!schools.length) {
      els.teacherSchoolSelect.innerHTML = `<option value="">—</option>`;
      els.teacherClassSelect.innerHTML = `<option value="">—</option>`;
      return;
    }

    schools.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      els.teacherSchoolSelect.appendChild(opt);
    });

    const selectedSchool = els.teacherSchoolSelect.value || schools[0];
    els.teacherSchoolSelect.value = selectedSchool;

    const classes = Object.keys(db.schools[selectedSchool] || {}).sort();
    els.teacherClassSelect.innerHTML = "";
    classes.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      els.teacherClassSelect.appendChild(opt);
    });
    if (classes.length) els.teacherClassSelect.value = classes[0];
  }

  function renderTeacherTable() {
    const db = teacherDbLoad();
    const school = els.teacherSchoolSelect.value;
    const klass = els.teacherClassSelect.value;

    els.teacherReportWrap.classList.add("hidden");

    if (!school || !klass || !db.schools[school] || !db.schools[school][klass]) {
      els.teacherTableWrap.innerHTML = `<div class="muted" style="padding:12px;">Importe arquivos para ver a turma.</div>`;
      return;
    }

    const ids = db.schools[school][klass];
    const rows = ids.map(pid => db.students[pid]).filter(Boolean);

    // montar tabela
    const table = document.createElement("table");
    table.className = "teacher-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>Aluno</th>
          <th>Ano</th>
          <th>Progresso</th>
          <th>Chefões (80%)</th>
          <th>Mastery justo</th>
          <th>Ativo (7d)</th>
          <th>Última</th>
          <th>Dificuldades</th>
          <th>Erro top</th>
          <th>Inclusão</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");

    rows.forEach(obj => {
      const { masteryJusto, coverage } = computeMasteryJusto(obj.skills);
      const u = unitsStatsFromExport(obj);
      const last = obj.overview ? obj.overview.lastActiveAt : null;

      const diff = topDifficulties(obj.skills, obj.errors, 2);
      const diffText = diff.length ? diff.map(d => `${skillTitle(d.skillId)} (${Math.round(d.mastery)})`).join("; ") : "—";

      const errTop = obj.errors && obj.errors.byType ? Object.entries(obj.errors.byType).sort((a,b)=>b[1]-a[1])[0] : null;
      const errText = errTop ? `${errTop[0]} (${errTop[1]})` : "—";

      const activeDays = obj.overview ? (obj.overview.weeklyActiveDays ?? 0) : 0;

      const badgeClass = masteryJusto < 50 ? "low" : (masteryJusto < 70 ? "mid" : "high");
      const evidenceWarn = coverage < 5 ? " ⚠️" : "";

      const inc = obj.settings && obj.settings.inclusion ? obj.settings.inclusion : {};
      const icons = [];
      if (inc.noTimer) icons.push("⏱️off");
      if (inc.readingEasy) icons.push("📖");
      if (inc.focusMode) icons.push("🧠");
      if (inc.reduceMotion) icons.push("🌀");
      const iconHtml = icons.length ? icons.map(x => `<span class="ic" title="${x}">${escapeHtml(x)}</span>`).join("") : `<span class="muted">—</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHtml(obj.student.firstName)}</strong></td>
        <td>${gradeLabel(obj.student.gradeYear)}</td>
        <td>${u.unitsPassed}/${u.unitsSeen}</td>
        <td>${u.bossesPassed}/${u.bossesTried}</td>
        <td><span class="badge ${badgeClass}">${masteryJusto}${evidenceWarn}</span></td>
        <td>${activeDays}</td>
        <td>${formatDateTime(last)}</td>
        <td>${escapeHtml(diffText)}</td>
        <td>${escapeHtml(errText)}</td>
        <td><span class="iconset">${iconHtml}</span></td>
      `;
      tbody.appendChild(tr);
    });

    els.teacherTableWrap.innerHTML = "";
    els.teacherTableWrap.appendChild(table);
  }

  function teacherExportCsv() {
    const db = teacherDbLoad();
    const school = els.teacherSchoolSelect.value;
    const klass = els.teacherClassSelect.value;
    if (!school || !klass || !db.schools[school] || !db.schools[school][klass]) {
      toast("Selecione escola e turma.");
      return;
    }
    const ids = db.schools[school][klass];
    const rows = ids.map(pid => db.students[pid]).filter(Boolean);

    const header = [
      "Escola","Turma","Ano","Aluno","ProfileId","Ativo_7dias","Ultima_atividade","Sessoes_total","Minutos_total",
      "Unidades_vistas","Unidades_passadas","Chefoes_tentados","Chefoes_passados","Mastery_justo","Cobertura_skills",
      "Top_dificuldade_1","Top_dificuldade_1_mastery","Top_dificuldade_2","Top_dificuldade_2_mastery","Erro_tipo_top","Erro_tipo_top_qtd","Inclusao_flags","Recomendacao_5a10min"
    ];

    const lines = [header.join(",")];

    rows.forEach(obj => {
      const { masteryJusto, coverage } = computeMasteryJusto(obj.skills);
      const u = unitsStatsFromExport(obj);
      const last = obj.overview ? obj.overview.lastActiveAt : null;
      const activeDays = obj.overview ? (obj.overview.weeklyActiveDays ?? 0) : 0;
      const sessions = obj.overview ? (obj.overview.totalSessions ?? 0) : 0;
      const minutes = obj.overview ? (obj.overview.totalMinutes ?? 0) : 0;

      const diffs = topDifficulties(obj.skills, obj.errors, 2);
      const d1 = diffs[0] ? skillTitle(diffs[0].skillId) : "";
      const d1m = diffs[0] ? Math.round(diffs[0].mastery) : "";
      const d2 = diffs[1] ? skillTitle(diffs[1].skillId) : "";
      const d2m = diffs[1] ? Math.round(diffs[1].mastery) : "";

      const errTop = obj.errors && obj.errors.byType ? Object.entries(obj.errors.byType).sort((a,b)=>b[1]-a[1])[0] : null;
      const errType = errTop ? errTop[0] : "";
      const errCnt = errTop ? errTop[1] : "";

      const inc = obj.settings && obj.settings.inclusion ? obj.settings.inclusion : {};
      const flags = [];
      if (inc.focusMode) flags.push("focusMode");
      if (inc.noTimer) flags.push("noTimer");
      if (inc.readingEasy) flags.push("readingEasy");
      if (inc.reduceMotion) flags.push("reduceMotion");
      const rec = autoRecommendation(obj);

      const fields = [
        school,
        klass,
        obj.student.gradeYear,
        obj.student.firstName,
        obj.profileId,
        activeDays,
        formatDateTime(last),
        sessions,
        minutes,
        u.unitsSeen,
        u.unitsPassed,
        u.bossesTried,
        u.bossesPassed,
        masteryJusto,
        coverage,
        d1,
        d1m,
        d2,
        d2m,
        errType,
        errCnt,
        flags.join("|"),
        rec
      ].map(csvEscape);

      lines.push(fields.join(","));
    });

    const filename = `desempenho_${sanitizeFile(school)}_${sanitizeFile(klass)}_${todayKey()}.csv`;
    downloadCsv(filename, lines.join("\n"));
  }

  function autoRecommendation(obj) {
    const errTop = obj.errors && obj.errors.byType ? Object.entries(obj.errors.byType).sort((a,b)=>b[1]-a[1])[0] : null;
    const errType = errTop ? errTop[0] : "";
    const { masteryJusto } = computeMasteryJusto(obj.skills);

    if (errType === "E_FACT") return "Microtreino fatos (3 min) + SR 5 itens.";
    if (errType === "E_PLACE") return "Valor posicional/decimais (8 min) + 2 itens do chefão.";
    if (errType === "E_READ") return "Problemas em etapas (pedido/dados) (10 min).";
    if (masteryJusto < 50) return "Base rápida: 2 dias de treino curto + SR diária.";
    return "SR diária (3 itens) + tentar chefão (80%).";
  }

  function csvEscape(v) {
    const s = String(v ?? "");
    if (/[,"\n]/.test(s)) return `"${s.replaceAll('"','""')}"`;
    return s;
  }

  function sanitizeFile(name) {
    return String(name || "arquivo").replace(/[\\\/:*?"<>|]/g, "_").slice(0, 40);
  }

  function teacherGenerateReport() {
    const db = teacherDbLoad();
    const school = els.teacherSchoolSelect.value;
    const klass = els.teacherClassSelect.value;
    if (!school || !klass || !db.schools[school] || !db.schools[school][klass]) {
      toast("Selecione escola e turma.");
      return;
    }
    const ids = db.schools[school][klass];
    const rows = ids.map(pid => db.students[pid]).filter(Boolean);

    // agregados
    const nTotal = rows.length;
    const active = rows.map(r => r.overview ? (r.overview.weeklyActiveDays ?? 0) : 0);
    const nActive = active.filter(x => x > 0).length;

    const masteryArr = rows.map(r => computeMasteryJusto(r.skills).masteryJusto);
    const masteryTurma = masteryArr.length ? Math.round(masteryArr.reduce((a,b)=>a+b,0)/masteryArr.length) : 0;

    let unitsSeenAvg = 0, unitsPassAvg = 0, bossTried = 0, bossPass = 0;
    rows.forEach(r => {
      const u = unitsStatsFromExport(r);
      unitsSeenAvg += u.unitsSeen;
      unitsPassAvg += u.unitsPassed;
      bossTried += u.bossesTried;
      bossPass += u.bossesPassed;
    });
    unitsSeenAvg = nTotal ? Math.round(unitsSeenAvg / nTotal) : 0;
    unitsPassAvg = nTotal ? Math.round(unitsPassAvg / nTotal) : 0;

    // top difficulties turma
    const allDiff = [];
    rows.forEach(r => topDifficulties(r.skills, r.errors, 3).forEach(d => allDiff.push(d.skillId)));
    const diffCount = {};
    allDiff.forEach(sid => diffCount[sid] = (diffCount[sid]||0)+1);
    const top3 = Object.entries(diffCount).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);

    // top errors
    const errCount = {};
    rows.forEach(r => {
      const bt = (r.errors && r.errors.byType) ? r.errors.byType : {};
      Object.entries(bt).forEach(([k,v]) => errCount[k]=(errCount[k]||0)+v);
    });
    const errTop = Object.entries(errCount).sort((a,b)=>b[1]-a[1]).slice(0,3);

    const periodEnd = todayKey();
    const periodStartDate = new Date(parseDateKey(periodEnd));
    periodStartDate.setDate(periodStartDate.getDate() - 6);
    const periodStart = `${periodStartDate.getFullYear()}-${String(periodStartDate.getMonth()+1).padStart(2,"0")}-${String(periodStartDate.getDate()).padStart(2,"0")}`;

    const report = [];
    report.push(`Escola: ${school}`);
    report.push(`Turma: ${klass}`);
    report.push(`Período: ${periodStart} a ${periodEnd} (últimos 7 dias)`);
    report.push(`Alunos importados: ${nTotal} | Ativos na semana: ${nActive}`);
    report.push("");
    report.push("1) Visão geral");
    report.push(`- Progresso (unidades): média ${unitsPassAvg}/${unitsSeenAvg}`);
    report.push(`- Mastery médio (justo): ${masteryTurma}`);
    report.push(`- Chefões (80%): ${bossPass}/${bossTried}`);
    report.push("");
    report.push("2) Principais dificuldades (Top 3)");
    if (!top3.length) report.push("- —");
    else top3.forEach((sid, i) => report.push(`${i+1}) ${skillTitle(sid)}`));
    report.push("");
    report.push("3) Erros mais frequentes");
    if (!errTop.length) report.push("- —");
    else errTop.forEach(([k,v]) => report.push(`- ${k}: ${v}`));
    report.push("");
    report.push("4) Plano de ação (10 min) para a próxima aula");
    report.push("- 3 min: microtreino (fato/pré-requisito)");
    report.push("- 5 min: SR (5 itens vencidos)");
    report.push("- 2 min: mini-checagem (2 itens do chefão)");
    report.push("");
    report.push("5) Observações");
    report.push("- Separar grupos: Base (<50), Consolidação (50–69), Avança (≥70).");
    report.push("- Para inclusão: preferir sem tempo + leitura fácil + sessões curtas (3 min).");
    report.push("");
    report.push("Assinatura: ______________________________");

    els.teacherReportText.value = report.join("\n");
    els.teacherReportWrap.classList.remove("hidden");
  }

  /* =========================
     Export (student)
     ========================= */

  function exportProgressJson() {
    if (!progress) { toast("Sem perfil ativo."); return; }
    // montar schema v1.2
    const unitsArr = Object.entries(progress.units).map(([nodeId, r]) => ({
      nodeId,
      attempts: r.attempts || 0,
      bestScore: Number(r.bestScore || 0),
      passed: !!r.passed,
      stars: Number(r.stars || 0),
      lastAttemptAt: r.lastAttemptAt || null,
    }));

    const { weeklyActiveDays } = calcWeeklyActiveDays(progress);
    progress.history.weeklyActiveDays = weeklyActiveDays;

    const exportObj = {
      schema: "progress_export",
      schemaVersion: "1.2",
      exportedAt: new Date().toISOString(),
      app: { name: APP.name, version: APP.version },
      profileId: progress.profileId,
      student: {
        firstName: progress.student.firstName,
        gradeYear: progress.student.gradeYear,
        classGroup: progress.student.classGroup,
      },
      school: { name: progress.school.name },
      overview: {
        startEntry: trackKeyFromGrade(progress.startEntry),
        currentYearTrack: progress.currentYearTrack,
        totalSessions: progress.history.totalSessions,
        totalMinutes: progress.history.totalMinutes,
        weeklyActiveDays: progress.history.weeklyActiveDays,
        lastActiveAt: progress.history.lastActiveAt,
        firstSeenAt: progress.history.firstSeenAt,
      },
      units: unitsArr,
      skills: progress.skills,
      errors: progress.errors,
      settings: {
        inclusion: {
          focusMode: !!progress.settings.focusMode,
          noTimer: !!progress.settings.noTimer,
          readingEasy: !!progress.settings.readingEasy,
          reduceMotion: !!progress.settings.reduceMotion,
        }
      }
    };

    const filename = `progresso_${sanitizeFile(progress.school.name)}_${sanitizeFile(progress.student.classGroup)}_${sanitizeFile(progress.student.firstName)}_${todayKey()}.json`;
    downloadJson(filename, exportObj);
    toast("Progresso exportado!");
  }

  function calcWeeklyActiveDays(prog) {
    // estimativa simples: se lastActiveAt está nos últimos 7 dias, usa 1
    // Para maior fidelidade: registrar set de dias. Mantemos simples.
    // Aqui: usa streak.lastActiveDate e assume 1 (mínimo).
    let days = 0;
    const last = prog.streak.lastActiveDate;
    if (last) {
      const delta = diffDays(last, todayKey());
      days = delta <= 6 ? 1 : 0;
    }
    return { weeklyActiveDays: days };
  }

  /* =========================
     Diagnostic (Entrada 6º)
     ========================= */

  let diagnostic = null;

  function startDiagnostic() {
    // 12 itens: base (tabuada/divisão/decimais/ordem)
    const plan = [
      "g4_mul_facts_6_9", "g4_mul_facts_6_9", "g5_div_2digit",
      "g6_dec_compare", "g6_dec_compare", "g6_order_ops",
      "g4_frac_equiv", "g6_frac_equiv",
      "g2_place_value",
      "g6_percent_simple",
      "g6_order_ops",
      "g5_dec_addsub",
    ];
    diagnostic = {
      idx: 0,
      correct: 0,
      questions: plan.map(sid => (GEN[sid] ? GEN[sid]() : genOrderOps())),
    };
    $("diagnostic-progress").textContent = `1/${diagnostic.questions.length}`;
    renderDiagnosticQuestion();
    showScreen("diagnostic-screen");
  }

  function renderDiagnosticQuestion() {
    const q = diagnostic.questions[diagnostic.idx];
    $("diagnostic-question").textContent = formatPrompt(q.prompt, progress.settings.readingEasy);
    const box = $("diagnostic-options");
    box.innerHTML = "";
    q.options.forEach(opt => {
      const b = document.createElement("button");
      b.className = "option-btn";
      b.textContent = String(opt);
      b.addEventListener("click", () => {
        const ok = String(opt) === String(q.correct);
        if (ok) diagnostic.correct += 1;
        // atualiza mastery de leve
        updateMastery(q.skillId || "g6_order_ops", ok, "mid");
        if (!ok) recordError(q.errorType || "E_OTHER", q.skillId);
        saveProgress();

        diagnostic.idx += 1;
        if (diagnostic.idx >= diagnostic.questions.length) {
          finishDiagnostic();
        } else {
          $("diagnostic-progress").textContent = `${diagnostic.idx + 1}/${diagnostic.questions.length}`;
          renderDiagnosticQuestion();
        }
      });
      box.appendChild(b);
    });
  }

  function finishDiagnostic() {
    const total = diagnostic.questions.length;
    const score = total ? diagnostic.correct / total : 0;
    // recomendação: se < 60% ativa inclusão pack e sugere base
    if (score < 0.60) {
      progress.settings.inclusionPack = true;
      progress.settings.focusMode = true;
      progress.settings.noTimer = true;
      progress.settings.readingEasy = true;
      toast("Ativei o pacote de inclusão e recomendo começar na Base (1º ano) por alguns dias.");
      progress.currentYearTrack = "g1";
    } else {
      progress.currentYearTrack = "g6";
      toast("Boa! Você pode começar no 6º ano.");
    }
    saveProgress();
    diagnostic = null;
    renderMap();
    showScreen("trails-screen");
  }

  /* =========================
     Settings / Shop
     ========================= */

  function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");
  }

  function toggleModeRapid() {
    UI.mode = "rapid";
    syncSettingsUI();
    toast("Modo Rápido ativado.");
  }

  function toggleModeStudy() {
    UI.mode = "study";
    syncSettingsUI();
    toast("Modo Estudo ativado.");
  }

  function applySettingsFromUI() {
    if (!progress) return;
    progress.settings.noTimer = $("set-no-timer").checked;
    progress.settings.readingEasy = $("set-reading-easy").checked;
    progress.settings.focusMode = $("set-focus-mode").checked;
    progress.settings.reduceMotion = $("set-reduce-motion").checked;
    progress.settings.voice = $("set-voice").checked;
    progress.settings.libras = $("set-libras").checked;

    saveProgress();
    syncSettingsUI();
    toast("Configurações salvas.");
  }

  function buyFreeze() {
    if (!progress) return;
    if (progress.coins < APP.freezePrice) {
      toast("Moedas insuficientes.");
      return;
    }
    progress.coins -= APP.freezePrice;
    progress.streak.freezes = (progress.streak.freezes || 0) + 1;
    saveProgress();
    toast("🧊 Bloqueio comprado!");
    renderHomeProfile();
  }

  function enableInclusionPack() {
    if (!progress) return;
    progress.settings.inclusionPack = true;
    progress.settings.focusMode = true;
    progress.settings.noTimer = true;
    progress.settings.readingEasy = true;
    progress.settings.reduceMotion = true;
    saveProgress();
    syncSettingsUI();
    toast("Pacote Inclusão ativado (gratuito).");
  }

  /* =========================
     Wire events
     ========================= */

  function wireEvents() {
    // Home navigation
    $("btn-manage-profiles").addEventListener("click", () => { renderProfiles(); showScreen("profiles-screen"); });
    $("btn-go-trails").addEventListener("click", () => {
      if (!progress) { renderProfiles(); showScreen("profiles-screen"); return; }
      renderMap(); showScreen("trails-screen");
    });
    $("btn-go-practice").addEventListener("click", () => { showScreen("practice-screen"); });
    $("btn-go-teacher").addEventListener("click", () => { renderTeacherSelectors(); renderTeacherTable(); showScreen("teacher-screen"); });
    $("btn-go-obmep").addEventListener("click", () => {
      if (!progress) { renderProfiles(); showScreen("profiles-screen"); return; }
      renderWeeklyScreen(); showScreen("weekly-screen");
    });

    $("btn-export-progress").addEventListener("click", exportProgressJson);

    // Back buttons
    $("btn-back-home-from-profiles").addEventListener("click", () => showScreen("home-screen"));
    $("btn-back-home-from-trails").addEventListener("click", () => showScreen("home-screen"));
    $("btn-back-home-from-practice").addEventListener("click", () => showScreen("home-screen"));
    $("btn-back-home-from-weekly").addEventListener("click", () => showScreen("home-screen"));
    $("btn-back-from-errors").addEventListener("click", () => showScreen("trails-screen"));
    $("btn-back-home-from-result").addEventListener("click", () => showScreen("home-screen"));
    $("btn-back-home-from-shop").addEventListener("click", () => showScreen("home-screen"));
    $("btn-back-home-from-teacher").addEventListener("click", () => showScreen("home-screen"));
    $("btn-back-home-from-settings").addEventListener("click", () => showScreen("home-screen"));

    // Settings and shop
    $("btn-settings").addEventListener("click", () => { if (!progress) { toast("Selecione um perfil."); return; } syncSettingsUI(); showScreen("settings-screen"); });
    $("btn-shop").addEventListener("click", () => { if (!progress) { toast("Selecione um perfil."); return; } $("freeze-price").textContent = String(APP.freezePrice); showScreen("shop-screen"); });
    $("toggle-night-mode").addEventListener("click", toggleDarkMode);

    // Mode
    $("mode-rapido").addEventListener("click", toggleModeRapid);
    $("mode-estudo").addEventListener("click", toggleModeStudy);

    // Home quick toggles
    $("toggle-voice-read").addEventListener("click", () => { if (!progress) return; progress.settings.voice = !progress.settings.voice; saveProgress(); syncSettingsUI(); });
    $("toggle-libras").addEventListener("click", () => { if (!progress) return; progress.settings.libras = !progress.settings.libras; saveProgress(); syncSettingsUI(); });
    $("toggle-focus-mode").addEventListener("click", () => { if (!progress) return; progress.settings.focusMode = !progress.settings.focusMode; saveProgress(); syncSettingsUI(); });
    $("toggle-reading-easy").addEventListener("click", () => { if (!progress) return; progress.settings.readingEasy = !progress.settings.readingEasy; saveProgress(); syncSettingsUI(); });

    // Profile list actions
    els.profilesList.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const act = btn.dataset.act;
      const id = btn.dataset.id;
      if (!act || !id) return;
      if (act === "select") {
        setActiveProfile(id);
        // Se entrada 6º: diagnóstico apenas uma vez (se ainda está no g6 mas sem histórico)
        if (progress.startEntry === 6 && progress.history.totalSessions === 0) {
          startDiagnostic();
        } else {
          toast("Perfil selecionado.");
          showScreen("home-screen");
        }
      }
      if (act === "delete") {
        if (confirm("Excluir este perfil e seus dados?")) {
          deleteProfile(id);
          renderProfiles();
          renderHomeProfile();
        }
      }
    });

    // Create profile
    els.profileForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const firstName = normalizeName(els.pfFirstName.value);
      const gradeYear = Number(els.pfGradeYear.value);
      const classGroup = normalizeName(els.pfClassGroup.value);
      const schoolName = String(els.pfSchoolName.value || "").trim().slice(0, 120);
      const startEntry = Number((document.querySelector('input[name="pf-startEntry"]:checked') || {}).value || 1);

      if (!firstName || !gradeYear || !classGroup || !schoolName) {
        toast("Preencha os campos obrigatórios.");
        return;
      }

      const profileId = `p_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(2, 6)}`;
      const p = { profileId, firstName, gradeYear, classGroup, schoolName, startEntry, createdAt: new Date().toISOString() };
      profiles.unshift(p);
      saveProfiles();

      progress = newProgressForProfile(p);
      save(APP.storage.progressPrefix + profileId, progress);

      setActiveProfile(profileId);
      renderProfiles();
      toast("Perfil criado!");

      if (startEntry === 6) startDiagnostic();
      else {
        renderMap();
        showScreen("trails-screen");
      }
    });

    // Trails
    els.trackYearSelect.addEventListener("change", () => {
      if (!progress) return;
      progress.currentYearTrack = els.trackYearSelect.value;
      saveProgress();
      renderMap();
    });

    $("btn-start-sr").addEventListener("click", startSRSession);
    $("btn-open-errors").addEventListener("click", () => { renderErrorsSummary(); showScreen("errors-screen"); });

    // Errors screen
    $("btn-train-errors").addEventListener("click", startErrorTraining);
    $("btn-clear-errors").addEventListener("click", () => {
      if (!progress) return;
      if (confirm("Limpar histórico de erros?")) {
        progress.errors = { byType: {}, recent: [] };
        saveProgress();
        renderErrorsSummary();
        toast("Erros limpos.");
      }
    });

    // Practice
    $("btn-start-practice").addEventListener("click", () => {
      const topic = els.practiceTopic.value;
      const diff = els.practiceDiff.value;
      const count = Number(els.practiceCount.value || 10);
      UI.practice.noTimer = false;
      startPracticeSession(topic, diff, count, false);
    });
    $("btn-practice-no-timer").addEventListener("click", () => {
      const topic = els.practiceTopic.value;
      const diff = els.practiceDiff.value;
      const count = Number(els.practiceCount.value || 10);
      UI.practice.noTimer = true;
      startPracticeSession(topic, diff, count, true);
    });

    // Weekly
    $("btn-weekly-warmup").addEventListener("click", startWeeklyWarmup);
    $("btn-weekly-boss").addEventListener("click", startWeeklyBoss);

    // Session controls
    $("btn-exit-session").addEventListener("click", () => {
      stopTimer();
      if (confirm("Sair da sessão? Seu progresso nesta sessão não contará como chefão.")) {
        currentSession = null;
        showScreen("home-screen");
      } else {
        // retoma
        if (currentSession && currentSession.timerOn) {
          startTimer(currentSession.sessionBaseTime * currentSession.timeMultiplier);
        }
      }
    });

    els.btnHint.addEventListener("click", () => {
      const q = currentSession.questions[currentSession.idx];
      if (!q) return;
      els.hintArea.textContent = q.hint || "Dica: tente resolver passo a passo.";
      els.hintArea.classList.remove("hidden");
    });

    els.btnToggleTimer.addEventListener("click", () => {
      currentSession.timerOn = !currentSession.timerOn;
      updateTimerButtonLabel();
      toast(currentSession.timerOn ? "Tempo ativado." : "Tempo desativado.");
      renderQuestion();
    });

    els.btnTts.addEventListener("click", () => {
      const q = currentSession.questions[currentSession.idx];
      if (!q) return;
      speak(formatPrompt(q.prompt, progress.settings.readingEasy));
    });

    // Results
    $("btn-result-continue").addEventListener("click", continueAfterResult);
    $("btn-result-retry").addEventListener("click", retryAfterResult);

    // Shop
    els.btnBuyFreeze.addEventListener("click", buyFreeze);
    $("btn-enable-inclusion-pack").addEventListener("click", enableInclusionPack);

    // Settings screen
    ["set-no-timer","set-reading-easy","set-focus-mode","set-reduce-motion","set-voice","set-libras"]
      .forEach(id => $(id).addEventListener("change", applySettingsFromUI));

    $("btn-reset-profile-progress").addEventListener("click", () => {
      if (!progress) return;
      if (confirm("Zerar todo o progresso deste perfil?")) {
        const p = profiles.find(x => x.profileId === progress.profileId);
        progress = newProgressForProfile(p);
        saveProgress();
        syncSettingsUI();
        renderHomeProfile();
        toast("Progresso zerado.");
      }
    });

    $("btn-delete-profile").addEventListener("click", () => {
      if (!progress) return;
      if (confirm("Excluir este perfil e TODOS os dados?")) {
        const pid = progress.profileId;
        deleteProfile(pid);
        renderProfiles();
        renderHomeProfile();
        showScreen("home-screen");
      }
    });

    // Diagnostic cancel
    $("btn-cancel-diagnostic").addEventListener("click", () => {
      diagnostic = null;
      renderMap();
      showScreen("trails-screen");
    });

    // Teacher
    els.teacherImport.addEventListener("change", (e) => {
      const files = e.target.files;
      if (files && files.length) teacherImportFiles(files);
      e.target.value = "";
    });
    els.teacherSchoolSelect.addEventListener("change", () => { renderTeacherSelectors(); renderTeacherTable(); });
    els.teacherClassSelect.addEventListener("change", renderTeacherTable);

    $("btn-teacher-export-csv").addEventListener("click", teacherExportCsv);
    $("btn-teacher-report").addEventListener("click", teacherGenerateReport);
    $("btn-teacher-clear").addEventListener("click", () => {
      if (confirm("Limpar painel do professor? Isso apaga importações locais.")) {
        save(APP.storage.teacherDb, { students: {}, schools: {} });
        renderTeacherSelectors();
        renderTeacherTable();
        toast("Painel limpo.");
      }
    });

    $("btn-report-copy").addEventListener("click", async () => {
      const text = els.teacherReportText.value;
      try {
        await navigator.clipboard.writeText(text);
        toast("Relatório copiado.");
      } catch {
        toast("Não foi possível copiar automaticamente.");
      }
    });
    $("btn-report-download").addEventListener("click", () => {
      const school = els.teacherSchoolSelect.value || "escola";
      const klass = els.teacherClassSelect.value || "turma";
      const filename = `relatorio_${sanitizeFile(school)}_${sanitizeFile(klass)}_${todayKey()}.txt`;
      downloadText(filename, els.teacherReportText.value);
    });
  }

  /* =========================
     Init
     ========================= */

  function init() {
    cacheEls();
    loadProfiles();
    renderProfiles();

    // set default mode
    UI.mode = "rapid";

    // activate profile if exists
    if (activeProfileId && profiles.some(p => p.profileId === activeProfileId)) {
      setActiveProfile(activeProfileId);
    } else if (profiles.length) {
      setActiveProfile(profiles[0].profileId);
    } else {
      progress = null;
      renderHomeProfile();
    }

    // defaults
    if (!progress) {
      toast("Crie um perfil para começar.");
    }

    // initial teacher selectors
    renderTeacherSelectors();

    // weekly
    if (progress) renderWeeklyScreen();

    wireEvents();
  }

  document.addEventListener("DOMContentLoaded", init);

})();
