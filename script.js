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
    errors: [], 
    highScores: [], 

    // Timer (Modo Rápido)
    timer: null,
    timeLeft: 0, 
    maxTime: 0, 
    baseTimeStep: 1,      // 1 tick a cada 100ms (tempo normal)
    slowTimeStep: 0.5,    // 0.5 tick a cada 100ms (tempo mais lento)
    timeStep: 1,
    lowTimeAlerted: false,

    // Config da Tabuada (Multiplicação 0–20)
    multiplication: {
        mode: 'trail',      // 'trail' | 'direct' | 'random'
        tabuada: 7,
        multMin: 0,
        multMax: 20,
        // Faixa de tabuadas por nível (Multiplicação)
        trailMin: 0,
        trailMax: 20,
        trailRangeKey: '0-20',
        trailOrder: [],
        trailIndex: 0,
        roundMultipliers: [],
        roundPos: 0,
        pendingLevel: null
    },

    acertos: 0,
    erros: 0
};


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
    gameState.xp = parseInt(localStorage.getItem('matemagica_xp')) || 0;
    playerXPElement.textContent = `XP: ${gameState.xp}`;
}
function atualizarXP(amount) {
    gameState.xp += amount;
    playerXPElement.textContent = `XP: ${gameState.xp}`;
    localStorage.setItem('matemagica_xp', gameState.xp);
}

/** Carrega os erros do jogador do Local Storage. */
function carregarErros() {
    try {
        const errorsJson = localStorage.getItem('matemagica_errors');
        if (errorsJson) {
            gameState.errors = JSON.parse(errorsJson);
        }
    } catch (e) {
        console.error("Erro ao carregar erros do localStorage:", e);
        gameState.errors = [];
    }
}

/** Salva os erros atuais no Local Storage. */
function salvarErros() {
    try {
        // Limita o número de erros salvos para não sobrecarregar o localStorage
        const errorsToSave = gameState.errors.slice(-50); 
        localStorage.setItem('matemagica_errors', JSON.stringify(errorsToSave));
    } catch (e) {
        console.error("Erro ao salvar erros no localStorage:", e);
    }
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


function toSuperscript(num) {
    // Converte número inteiro para caracteres sobrescritos Unicode (ex.: 3 -> ³, 12 -> ¹²)
    const map = {
        '0': '⁰','1': '¹','2': '²','3': '³','4': '⁴','5': '⁵','6': '⁶','7': '⁷','8': '⁸','9': '⁹','-': '⁻'
    };
    return String(num).split('').map(ch => map[ch] ?? ch).join('');
}


// --- HELPERS (Tabuada e UI) ---
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
function rangeInclusive(min, max) {
    const out = [];
    for (let i = min; i <= max; i++) out.push(i);
    return out;
}



// Mapeia nível → faixa de tabuadas (Multiplicação)
function getTabuadaRangeByLevel(level) {
    switch (level) {
        case 'easy':
            // Fácil: tabuadas 0–5, multiplicadores 0–10
            return { min: 0, max: 5, multMin: 0, multMax: 10, label: 'Fácil (0–5 | ×0–10)' };
        case 'medium':
            // Médio: tabuadas 6–10, multiplicadores 0–10
            return { min: 6, max: 10, multMin: 0, multMax: 10, label: 'Médio (6–10 | ×0–10)' };
        case 'advanced':
            // Difícil: tabuadas 11–20, multiplicadores 0–20
            return { min: 11, max: 20, multMin: 0, multMax: 20, label: 'Difícil (11–20 | ×0–20)' };
        default:
            return { min: 0, max: 20, multMin: 0, multMax: 20, label: 'Completo (0–20 | ×0–20)' };
    }
}

function loadMultiplicationConfig() {
    try {
        const raw = localStorage.getItem('matemagica_mult_cfg');
        if (!raw) return;
        const cfg = JSON.parse(raw);
        if (!cfg || typeof cfg !== 'object') return;

        gameState.multiplication.mode = cfg.mode || gameState.multiplication.mode;
        if (Number.isInteger(cfg.tabuada)) gameState.multiplication.tabuada = cfg.tabuada;

        // faixa de tabuadas (persistida)
        if (Number.isInteger(cfg.trailMin)) gameState.multiplication.trailMin = cfg.trailMin;
        if (Number.isInteger(cfg.trailMax)) gameState.multiplication.trailMax = cfg.trailMax;
        if (typeof cfg.trailRangeKey === 'string') gameState.multiplication.trailRangeKey = cfg.trailRangeKey;

        // multiplicadores (persistidos, se houver)
        if (Number.isInteger(cfg.multMin)) gameState.multiplication.multMin = cfg.multMin;
        if (Number.isInteger(cfg.multMax)) gameState.multiplication.multMax = cfg.multMax;

        const min = Number.isInteger(gameState.multiplication.trailMin) ? gameState.multiplication.trailMin : 0;
        const max = Number.isInteger(gameState.multiplication.trailMax) ? gameState.multiplication.trailMax : 20;
        const expectedLen = Math.max(0, (max - min + 1));

        if (Array.isArray(cfg.trailOrder) && cfg.trailOrder.length === expectedLen) {
            gameState.multiplication.trailOrder = cfg.trailOrder;
        }
        if (Number.isInteger(cfg.trailIndex)) gameState.multiplication.trailIndex = cfg.trailIndex;
    } catch (e) {
        console.warn("Falha ao carregar config de multiplicação:", e);
    }
}

function saveMultiplicationConfig() {
    try {
        const payload = {
            mode: gameState.multiplication.mode,
            tabuada: gameState.multiplication.tabuada,
            trailMin: gameState.multiplication.trailMin,
            trailMax: gameState.multiplication.trailMax,
            trailRangeKey: gameState.multiplication.trailRangeKey,
            trailOrder: gameState.multiplication.trailOrder,
            trailIndex: gameState.multiplication.trailIndex,
            multMin: gameState.multiplication.multMin,
            multMax: gameState.multiplication.multMax
        };
        localStorage.setItem('matemagica_mult_cfg', JSON.stringify(payload));
    } catch (e) {
        console.warn("Falha ao salvar config de multiplicação:", e);
    }
}

function ensureTrailOrder(min = gameState.multiplication.trailMin, max = gameState.multiplication.trailMax) {
    // sanitiza
    if (!Number.isInteger(min)) min = 0;
    if (!Number.isInteger(max)) max = 20;
    if (min > max) [min, max] = [max, min];

    const expectedLen = (max - min + 1);
    const key = `${min}-${max}`;
    const sameRange = gameState.multiplication.trailRangeKey === key;

    if (!Array.isArray(gameState.multiplication.trailOrder) ||
        gameState.multiplication.trailOrder.length !== expectedLen ||
        !sameRange
    ) {
        gameState.multiplication.trailOrder = shuffleArray(rangeInclusive(min, max));
        gameState.multiplication.trailIndex = 0;
        gameState.multiplication.trailMin = min;
        gameState.multiplication.trailMax = max;
        gameState.multiplication.trailRangeKey = key;
        saveMultiplicationConfig();
    }

    // garante índice válido
    if (gameState.multiplication.trailIndex < 0 || gameState.multiplication.trailIndex >= expectedLen) {
        gameState.multiplication.trailIndex = 0;
    }
}

function getTrailTabuadaAtual() {
    ensureTrailOrder();
    return gameState.multiplication.trailOrder[gameState.multiplication.trailIndex];
}

function advanceTrailTabuada() {
    ensureTrailOrder();
    const len = Array.isArray(gameState.multiplication.trailOrder) ? gameState.multiplication.trailOrder.length : 0;

    gameState.multiplication.trailIndex++;

    if (len > 0 && gameState.multiplication.trailIndex >= len) {
        // terminou o ciclo da faixa atual → cria uma nova ordem
        const min = Number.isInteger(gameState.multiplication.trailMin) ? gameState.multiplication.trailMin : 0;
        const max = Number.isInteger(gameState.multiplication.trailMax) ? gameState.multiplication.trailMax : 20;
        gameState.multiplication.trailOrder = shuffleArray(rangeInclusive(min, max));
        gameState.multiplication.trailIndex = 0;
    }
    saveMultiplicationConfig();
}

function prepareRoundMultipliersForCurrentLevel() {
    const multMax = Number.isInteger(gameState.multiplication.multMax) ? gameState.multiplication.multMax : 20;
    const multMin = Number.isInteger(gameState.multiplication.multMin) ? gameState.multiplication.multMin : 0;
    gameState.multiplication.roundMultipliers = shuffleArray(rangeInclusive(multMin, multMax));
    gameState.multiplication.roundPos = 0;
}

function getNextRoundMultiplier() {
    const multMax = Number.isInteger(gameState.multiplication.multMax) ? gameState.multiplication.multMax : 20;
    const multMin = Number.isInteger(gameState.multiplication.multMin) ? gameState.multiplication.multMin : 0;
    const expectedLen = (multMax - multMin + 1);

    if (!Array.isArray(gameState.multiplication.roundMultipliers) || gameState.multiplication.roundMultipliers.length !== expectedLen) {
        prepareRoundMultipliersForCurrentLevel();
    }
    if (gameState.multiplication.roundPos >= gameState.multiplication.roundMultipliers.length) {
        prepareRoundMultipliersForCurrentLevel();
    }
    const v = gameState.multiplication.roundMultipliers[gameState.multiplication.roundPos];
    gameState.multiplication.roundPos++;
    return v;
}


// Modal: escolha de Tabuada / Trilha
function ensureMultiplicationModal() {
    if (document.getElementById('mm-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'mm-modal-overlay';
    overlay.className = 'mm-modal-overlay hidden';
    overlay.innerHTML = `
        <div class="mm-modal" role="dialog" aria-modal="true" aria-label="Configuração da multiplicação">
            <div class="mm-modal-header">
                <h2>Multiplicação — Tabuada</h2>
                <button class="mm-close" type="button" aria-label="Fechar">✕</button>
            </div>
            <p class="mm-sub" id="mm-range-line">Nível: —</p>
            <p class="mm-sub">Escolha como você quer treinar:</p>

            <div class="mm-actions">
                <button type="button" class="mm-btn mm-primary" data-mm="trail">🗺️ Trilha automática</button>
                <button type="button" class="mm-btn" data-mm="direct">🎯 Escolher tabuada</button>
            </div>

            <div class="mm-direct hidden" aria-label="Escolher tabuada">
                <p class="mm-sub2" id="mm-direct-title">Selecione a tabuada:</p>
                <div class="mm-grid" id="mm-grid"></div>
            </div>

            <div class="mm-footer">
                <small id="mm-footer-tip">Dica: a trilha percorre as tabuadas desta faixa em uma ordem aleatória.</small>
            </div>
        </div>
`;
    document.body.appendChild(overlay);

    const getCurrentRange = () => getTabuadaRangeByLevel(gameState.multiplication.pendingLevel || gameState.currentLevel || 'medium');

    const renderRangeTexts = () => {
        const r = getCurrentRange();
        const rangeLine = overlay.querySelector('#mm-range-line');
        const footerTip = overlay.querySelector('#mm-footer-tip');
        const directTitle = overlay.querySelector('#mm-direct-title');
        if (rangeLine) rangeLine.textContent = `Nível: ${r.label} — Tabuadas ${r.min} a ${r.max} — Multiplicadores ${r.multMin} a ${r.multMax}`;
        if (footerTip) footerTip.textContent = `Dica: a trilha percorre as tabuadas de ${r.min} a ${r.max} em ordem aleatória, usando multiplicadores de ${r.multMin} a ${r.multMax} (também em ordem aleatória).`;
        if (directTitle) directTitle.textContent = `Selecione a tabuada (${r.min} a ${r.max}):`;
    };

    const renderTabuadaGrid = () => {
        const r = getCurrentRange();
        const grid = overlay.querySelector('#mm-grid');
        if (!grid) return;
        grid.innerHTML = '';
        for (let i = r.min; i <= r.max; i++) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mm-grid-btn';
            b.textContent = String(i);
            b.addEventListener('click', () => {
                gameState.multiplication.mode = 'direct';
                gameState.multiplication.tabuada = i;
                // persiste a faixa atual também
                gameState.multiplication.trailMin = r.min;
                gameState.multiplication.trailMax = r.max;
                gameState.multiplication.trailRangeKey = `${r.min}-${r.max}`;
                gameState.multiplication.multMin = r.multMin;
                gameState.multiplication.multMax = r.multMax;
                saveMultiplicationConfig();
                close();
                startGame('multiplication', gameState.multiplication.pendingLevel || gameState.currentLevel || 'medium');
            });
            grid.appendChild(b);
        }
    };

    // Render inicial (atualiza quando abrir)
    renderRangeTexts();

    const close = () => overlay.classList.add('hidden');
    overlay.querySelector('.mm-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    // Botões principais
    overlay.querySelector('[data-mm="trail"]').addEventListener('click', () => {
        const r = getCurrentRange();
        gameState.multiplication.mode = 'trail';
        // define a faixa do nível e cria ordem aleatória só dentro dela
        ensureTrailOrder(r.min, r.max);
        gameState.multiplication.tabuada = getTrailTabuadaAtual();
        saveMultiplicationConfig();
        close();
        startGame('multiplication', gameState.multiplication.pendingLevel || gameState.currentLevel || 'medium');
    });

    overlay.querySelector('[data-mm="direct"]').addEventListener('click', () => {
        overlay.querySelector('.mm-direct').classList.remove('hidden');
        renderRangeTexts();
        renderTabuadaGrid();
    });
}

function openMultiplicationConfig(level) {
    ensureMultiplicationModal();
    gameState.multiplication.pendingLevel = level;

    // Ajusta a faixa de tabuadas conforme o nível selecionado
    const r = getTabuadaRangeByLevel(level);
    gameState.multiplication.trailMin = r.min;
    gameState.multiplication.trailMax = r.max;
    gameState.multiplication.trailRangeKey = `${r.min}-${r.max}`;
    gameState.multiplication.multMin = r.multMin;
    gameState.multiplication.multMax = r.multMax;
    saveMultiplicationConfig();

    const overlay = document.getElementById('mm-modal-overlay');
    if (!overlay) return;

    // Atualiza textos do modal para a faixa do nível
    const rangeLine = overlay.querySelector('#mm-range-line');
    const footerTip = overlay.querySelector('#mm-footer-tip');
    const directTitle = overlay.querySelector('#mm-direct-title');
    if (rangeLine) rangeLine.textContent = `Nível: ${r.label} — Tabuadas ${r.min} a ${r.max} — Multiplicadores ${r.multMin} a ${r.multMax}`;
    if (footerTip) footerTip.textContent = `Dica: a trilha percorre as tabuadas de ${r.min} a ${r.max} em ordem aleatória, usando multiplicadores de ${r.multMin} a ${r.multMax} (também em ordem aleatória).`;
    if (directTitle) directTitle.textContent = `Selecione a tabuada (${r.min} a ${r.max}):`;

    overlay.classList.remove('hidden');
}

/**
 * Gera uma questão matemática baseada na operação e nível de dificuldade.
 * @param {string} operation - A operação matemática.
 * @returns {object} { question: string, answer: number, options: number[] }
 */
function generateQuestion(operation) {
    let num1, num2, answer, questionString, questionSpeak;
    
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
            questionSpeak = `${num1} mais ${num2}`;
            break;
        case 'subtraction':
            num1 = randomInt(20 * diffFactor, 80 * diffFactor);
            num2 = randomInt(5 * diffFactor, num1 - (10 * diffFactor));
            answer = num1 - num2;
            questionString = `${num1} - ${num2}`;
            questionSpeak = `${num1} menos ${num2}`;
            break;
        case 'multiplication':
            // Tabuada (0–20) — modo direto ou trilha automática
            if (gameState.multiplication && (gameState.multiplication.mode === 'direct' || gameState.multiplication.mode === 'trail')) {
                const t = gameState.multiplication.tabuada;
                const m = getNextRoundMultiplier(); // garante 0–20 (ordem embaralhada)
                num1 = t;
                num2 = m;
                answer = num1 * num2;
                questionString = `${num1} x ${num2}`;
                questionSpeak = `${num1} vezes ${num2}`;
            } else {
                // (modo livre antigo) Tabuadas mais altas no nível avançado
                num1 = randomInt(2, diffFactor < 3 ? 12 : 25); 
                num2 = randomInt(2, diffFactor < 3 ? 10 : 15);
                answer = num1 * num2;
                questionString = `${num1} x ${num2}`;
                questionSpeak = `${num1} vezes ${num2}`;
            }
            break;
        case 'division':
            let divisor = randomInt(2, diffFactor < 3 ? 8 : 12);
            let quotient = randomInt(2, diffFactor < 3 ? 10 : 20);
            num1 = divisor * quotient;
            num2 = divisor;
            answer = quotient;
            questionString = `${num1} ÷ ${num2}`;
            questionSpeak = `${num1} dividido por ${num2}`;
            break;
        case 'potenciacao':
            // Potências: exibir como 2³ e ler como “2 elevado a 3” no modo voz
            num1 = randomInt(2, diffFactor < 3 ? 5 : 8);
            num2 = randomInt(2, diffFactor < 3 ? 4 : 5);
            answer = Math.pow(num1, num2);
            questionString = `${num1}${toSuperscript(num2)}`;
            questionSpeak = `${num1} elevado a ${num2}`;
            break;
        case 'radiciacao':
            // Raízes quadradas maiores no nível avançado
            answer = randomInt(2, diffFactor < 3 ? 12 : 15);
            num1 = answer * answer;
            questionString = `√${num1}`;
            questionSpeak = `raiz quadrada de ${num1}`;
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

    
    // Texto para leitura em voz (se não definido, usa o mesmo do display)
    if (!questionSpeak) questionSpeak = questionString;

return { 
        question: questionString + ' = ?',
        voiceQuestion: questionSpeak, 
        answer: answer, 
        options: options,
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
    
    gameState.totalQuestions = gameState.isRapidMode ? 20 : Infinity;

    // --- Configuração especial: Tabuada da Multiplicação (por níveis) ---
if (operation === 'multiplication' && gameState.multiplication && (gameState.multiplication.mode === 'direct' || gameState.multiplication.mode === 'trail')) {
    const r = getTabuadaRangeByLevel(level);

    // Aplica a faixa do nível: tabuadas e multiplicadores
    gameState.multiplication.trailMin = r.min;
    gameState.multiplication.trailMax = r.max;
    gameState.multiplication.trailRangeKey = `${r.min}-${r.max}`;
    gameState.multiplication.multMin = r.multMin;
    gameState.multiplication.multMax = r.multMax;

    // Garante tabuada válida
    if (!Number.isInteger(gameState.multiplication.tabuada) || gameState.multiplication.tabuada < r.min || gameState.multiplication.tabuada > r.max) {
        gameState.multiplication.tabuada = r.min;
    }

    // Trilha: seleciona a tabuada atual da faixa (ordem aleatória)
    if (gameState.multiplication.mode === 'trail') {
        ensureTrailOrder(r.min, r.max);
        gameState.multiplication.tabuada = getTrailTabuadaAtual();
    }

    saveMultiplicationConfig();
    prepareRoundMultipliersForCurrentLevel();
}



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
    // Fim de jogo (Modo Rápido) OU rodada completa da Tabuada (modo direto/trilha)
    const isTabuadaRound = (gameState.currentOperation === 'multiplication' && gameState.multiplication && (gameState.multiplication.mode === 'direct' || gameState.multiplication.mode === 'trail'));
    if ((gameState.isRapidMode && gameState.questionNumber >= gameState.totalQuestions) || (isTabuadaRound && gameState.questionNumber >= gameState.totalQuestions)) {
        endGame();
        return;
    }
gameState.questionNumber++;
    
    // 1. Gerar nova questão 
    const newQ = generateQuestion(gameState.currentOperation);
    gameState.currentQuestion = newQ;
    // 2. Atualizar UI
    const totalDisplay = (gameState.isRapidMode || isTabuadaRound) ? gameState.totalQuestions : '∞';
    questionCounter.textContent = `Questão: ${gameState.questionNumber}/${totalDisplay}`;
    questionText.textContent = newQ.question;
    
    // 3. Atualizar opções de resposta
    answerOptions.forEach((btn, index) => {
        // Garante o prefixo "1) 2) 3) 4)" (menor que o número da resposta)
        let idxSpan = btn.querySelector('.answer-index');
        const txtSpan = btn.querySelector('.answer-text');
        if (!idxSpan) {
            idxSpan = document.createElement('span');
            idxSpan.className = 'answer-index';
            btn.insertBefore(idxSpan, txtSpan);
        }
        idxSpan.textContent = `${index + 1})`;

        // Usa o texto da opção gerada
        txtSpan.textContent = newQ.options[index];
        btn.classList.remove('correct', 'wrong');
        btn.disabled = false;
    });

    // 4. Leitura de Voz
    speak(`Questão ${gameState.questionNumber}. Qual é o resultado de ${newQ.voiceQuestion || newQ.question}`);
    if (gameState.isVoiceReadActive && Array.isArray(newQ.options) && newQ.options.length === 4) {
        speak(`Opções: 1) ${newQ.options[0]}. 2) ${newQ.options[1]}. 3) ${newQ.options[2]}. 4) ${newQ.options[3]}.`);
    }
}


/** Salva a pergunta que foi respondida incorretamente e persiste no localStorage. */
function saveError(question, userAnswer) {
    const errorData = {
        question: question.question,
        correctAnswer: question.answer,
        userAnswer: userAnswer,
        operation: question.operacao,
        timestamp: Date.now()
    };
    // Adiciona o novo erro no início da lista para manter os mais recentes visíveis
    gameState.errors.unshift(errorData); 
    salvarErros(); // Persiste no LocalStorage
}


function handleAnswer(selectedAnswer, selectedButton) {
    if (!gameState.isGameActive || selectedButton.disabled) return;

    if (gameState.isRapidMode) stopTimer();
    
    const isCorrect = selectedAnswer === gameState.currentQuestion.answer;
    const feedbackText = isCorrect ? 'RESPOSTA CORRETA!' : 'RESPOSTA INCORRETA!';
    
    // Desabilita todos os botões de resposta após o clique
    answerOptions.forEach(btn => btn.disabled = true);
    
    if (isCorrect) {
        selectedButton.classList.add('correct');
        // Se acertou, o tempo volta ao normal
        gameState.timeStep = gameState.baseTimeStep;
        gameState.lowTimeAlerted = false;
        // Se acertou, repõe o tempo total para a próxima questão (ex.: volta para 15s)
        if (gameState.isRapidMode) {
            gameState.timeLeft = gameState.maxTime;
            timeBar.style.width = '100%';
            timeBar.style.backgroundColor = 'var(--cor-sucesso)';
            librasAlert.classList.add('hidden');
        }
        
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
        // Se errou, o tempo continua correndo normalmente (não repõe o tempo)
        gameState.timeStep = gameState.baseTimeStep;
        
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
    const sugg = document.getElementById('study-suggestion');
    if (sugg) {
        if (gameState.currentOperation === 'multiplication' && gameState.multiplication && (gameState.multiplication.mode === 'direct' || gameState.multiplication.mode === 'trail')) {
            const modeLabel = gameState.multiplication.mode === 'trail' ? 'Trilha automática' : 'Tabuada escolhida';
            let msg = `${modeLabel}: Tabuada do ${gameState.multiplication.tabuada}. `;
            if (gameState.multiplication.mode === 'trail') {
                // próxima tabuada (prévia)
                ensureTrailOrder();
                const nextIndex = (gameState.multiplication.trailIndex + 1) > 20 ? 0 : (gameState.multiplication.trailIndex + 1);
                const nextTab = gameState.multiplication.trailOrder[nextIndex];
                msg += `Próxima: ${nextTab}.`;
            } else {
                msg += `Dica: faça “Treinar Erros” para fixar.`;
            }
            sugg.textContent = msg;
        } else {
            sugg.textContent = '';
        }
    }
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

        gameState.timeLeft -= gameState.timeStep;

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
            if (percentage < 10) {
                if (!gameState.lowTimeAlerted) {
                    playAlertSound();
                    gameState.lowTimeAlerted = true;
                }
            } else {
                gameState.lowTimeAlerted = false;
            }
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
            // Guarda a operação para ser usada quando o nível for selecionado
            gameState.currentOperation = button.getAttribute('data-operation');
            
            // MUDANÇA: Vai para a tela de seleção de nível
            exibirTela('level-selection-screen');
            speak(`Operação ${gameState.currentOperation} selecionada. Agora escolha o nível!`);
            showFeedbackMessage(`Operação ${gameState.currentOperation.toUpperCase()} selecionada. Agora escolha o nível!`, 'info', 2500);
        });
    });
    
    // 2. Seleção de Nível (Inicia o Jogo)
    levelButtons.forEach(button => {
        button.addEventListener('click', () => {
            const level = button.getAttribute('data-level');
            // Inicia o jogo com a operação já salva e o nível recém-clicado
            if (gameState.currentOperation === 'multiplication') {
                openMultiplicationConfig(level);
            } else {
                startGame(gameState.currentOperation, level);
            } 
        });
    });

    // Botão para voltar da tela de nível para a home (Mudar Operação)
    btnVoltarHome.forEach(button => {
        // Garantindo que apenas os botões de voltar da home usem o ID 'btn-voltar-home'
        // Os demais botões de voltar home já devem ter o listener anexado.
        button.addEventListener('click', () => {
            stopTimer(); // Para o timer se estiver ativo (ex: saindo do jogo)
            if (gameState.currentScreen === 'result-screen' && gameState.currentOperation === 'multiplication' && gameState.multiplication && gameState.multiplication.mode === 'trail') {
            // próximo passo da trilha
            advanceTrailTabuada();
            gameState.multiplication.tabuada = getTrailTabuadaAtual();
            saveMultiplicationConfig();
            // reinicia a rodada na mesma dificuldade
            startGame('multiplication', gameState.currentLevel || 'medium');
            return;
        }
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

    
    // 4.1 Responder pelo teclado (1,2,3,4) ou NumPad (1–4)
    document.addEventListener('keydown', (e) => {
        if (!gameState.isGameActive) return;

        // não captura se estiver digitando em algum campo (caso exista futuramente)
        const tag = (document.activeElement && document.activeElement.tagName) ? document.activeElement.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea') return;

        let idx = null;
        if (e.key === '1' || e.code === 'Numpad1') idx = 0;
        if (e.key === '2' || e.code === 'Numpad2') idx = 1;
        if (e.key === '3' || e.code === 'Numpad3') idx = 2;
        if (e.key === '4' || e.code === 'Numpad4') idx = 3;

        if (idx !== null) {
            e.preventDefault();
            const btn = answerOptions[idx];
            if (btn && !btn.disabled) btn.click();
        }

        // Atalho extra: R repete a leitura da questão (modo voz)
        if ((e.key === 'r' || e.key === 'R') && gameState.isVoiceReadActive && gameState.currentQuestion) {
            e.preventDefault();
            speak(`Questão ${gameState.questionNumber}. ${gameState.currentQuestion.voiceQuestion || gameState.currentQuestion.question}`);
        }
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
        exibirTela('ranking-screen');
        // TODO: Implementar lógica de exibição de ranking (futuro)
    });
    
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
    // 1. Carrega o estado persistente
    carregarXP();
    carregarErros(); 
    
    // 2. Anexa todos os listeners
    loadMultiplicationConfig();
    attachEventListeners();
    
    // 3. Atualiza o estado inicial do botão de Treinar Erros
    updateErrorTrainingButton();

    // Aplica o Dark Mode se o body já tiver a classe
    if (document.body.classList.contains('dark-mode')) {
        toggleNightMode.querySelector('.icon').textContent = '☀️';
    }
});