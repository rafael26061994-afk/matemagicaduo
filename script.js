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

// Cache de elementos de ranking
const btnShowRanking = document.getElementById('btn-show-ranking');
const rankingListContainer = document.getElementById('ranking-list-container');
const noRecordsMessage = document.getElementById('no-records-message');
const btnClearRanking = document.getElementById('btn-clear-ranking');


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
    timer: null,
    timeLeft: 0, 
    maxTime: 0, 
    acertos: 0,
    erros: 0,

    // Extras (melhorias rápidas)
    lastAlertSoundAt: 0,
    lowTimeAlertPlayed: false,
    isErrorTraining: false,
    trainingQueue: [],
    totalTraining: 0
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

/** Reproduz o som de alerta (com proteção contra repetição) */
function playAlertSound(force = false) {
    if (!alertSound) return;

    const now = Date.now();
    const minIntervalMs = 1200; // evita tocar "em loop" quando o tempo está baixo
    if (!force && (now - (gameState.lastAlertSoundAt || 0)) < minIntervalMs) return;

    gameState.lastAlertSoundAt = now;
    alertSound.currentTime = 0;
    alertSound.play().catch(e => console.error("Erro ao tocar áudio:", e));
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


// --- RANKING (Local Storage) ---

function carregarRanking() {
    try {
        const json = localStorage.getItem('matemagica_high_scores');
        gameState.highScores = json ? JSON.parse(json) : [];
        if (!Array.isArray(gameState.highScores)) gameState.highScores = [];
    } catch (e) {
        console.error("Erro ao carregar ranking:", e);
        gameState.highScores = [];
    }
}

function salvarRanking() {
    try {
        localStorage.setItem('matemagica_high_scores', JSON.stringify(gameState.highScores.slice(0, 10)));
    } catch (e) {
        console.error("Erro ao salvar ranking:", e);
    }
}

function renderRanking() {
    if (!rankingListContainer || !noRecordsMessage) return;

    rankingListContainer.innerHTML = '';

    if (!gameState.highScores || gameState.highScores.length === 0) {
        noRecordsMessage.classList.remove('hidden');
        return;
    }

    noRecordsMessage.classList.add('hidden');

    gameState.highScores.slice(0, 10).forEach((rec, idx) => {
        const item = document.createElement('div');
        item.classList.add('ranking-item');

        const date = rec.date ? new Date(rec.date).toLocaleDateString('pt-BR') : '';
        const op = rec.operation ? rec.operation.toUpperCase() : '';
        const lvl = rec.level ? rec.level.toUpperCase() : '';

        item.innerHTML = `
            <div>
                <strong>#${idx + 1} — ${rec.name || 'Anônimo'}</strong>
                <p style="margin-top: 6px;">${rec.score} pontos</p>
                <p style="font-size: 0.9em; opacity: 0.8;">${op} | ${lvl} ${date ? `| ${date}` : ''}</p>
            </div>
        `;
        rankingListContainer.appendChild(item);
    });
}

function tryAddHighScore() {
    // Só faz sentido no Modo Rápido (rodada fechada)
    if (!gameState.isRapidMode) return;

    const record = {
        name: '',
        score: gameState.score,
        operation: gameState.currentOperation,
        level: gameState.currentLevel,
        date: Date.now()
    };

    const scores = Array.isArray(gameState.highScores) ? gameState.highScores : [];
    const qualifies = scores.length < 10 || record.score > Math.min(...scores.map(s => s.score || 0));

    if (!qualifies) return;

    const rawName = window.prompt('🎉 Novo recorde! Digite seu nome (ou deixe em branco para "Anônimo"):', '') ?? '';
    const cleaned = rawName.trim().slice(0, 20);
    record.name = cleaned.length ? cleaned : 'Anônimo';

    scores.push(record);
    scores.sort((a, b) => (b.score || 0) - (a.score || 0));
    gameState.highScores = scores.slice(0, 10);
    salvarRanking();
}


// --- TREINAMENTO DE ERROS (transforma erro salvo em questão) ---

function buildQuestionFromSavedError(errorObj) {
    const answer = parseInt(errorObj.correctAnswer);
    const question = String(errorObj.question || '').trim();

    // Gera opções de resposta (inclui a correta + 3 distratores)
    const options = [answer];
    const diff = Math.max(2, Math.round(Math.abs(answer) * 0.15));

    while (options.length < 4) {
        const incorrect = answer + randomInt(-5 * diff, 5 * diff);
        if (incorrect >= 0 && !options.includes(incorrect)) options.push(incorrect);
    }

    // Embaralha as opções
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }

    return {
        question,
        answer,
        options,
        operacao: errorObj.operation || '',
        sourceTimestamp: errorObj.timestamp
    };
}

function removeSavedErrorByTimestamp(ts) {
    const idx = gameState.errors.findIndex(e => e.timestamp === ts);
    if (idx >= 0) gameState.errors.splice(idx, 1);
    salvarErros();
}

function finishErrorTraining() {
    gameState.isGameActive = false;
    gameState.isErrorTraining = false;

    // Atualiza a tela de erros e volta para ela
    updateErrorTrainingButton();
    exibirTela('error-training-screen');

    showFeedbackMessage(
        `Treinamento concluído! Acertos: ${gameState.acertos} | Erros: ${gameState.erros}`,
        'success',
        4500
    );
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


// --- Helpers de exibição e leitura (Potenciação / Voz) ---
const SUPERSCRIPT_MAP = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹' };
const REV_SUPERSCRIPT_MAP = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };

function toSuperscript(number) {
    return String(number).split('').map(ch => SUPERSCRIPT_MAP[ch] ?? ch).join('');
}

function fromSuperscript(text) {
    return String(text).split('').map(ch => REV_SUPERSCRIPT_MAP[ch] ?? ch).join('');
}

/** Converte a questão exibida para uma frase melhor para TTS. */
function questionToSpeech(rawQuestion) {
    if (!rawQuestion) return '';

    let q = String(rawQuestion).replace('= ?', '').trim();

    // Potenciação (novo): 2³ / 12⁴
    q = q.replace(/(\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_, base, expSup) => {
        const exp = fromSuperscript(expSup);
        return `${base} elevado a ${exp}`;
    });

    // Potenciação (antigo): 2ⁿ (3)
    q = q.replace(/(\d+)ⁿ\s*\((\d+)\)/g, (_, base, exp) => `${base} elevado a ${exp}`);

    // Raiz: √144
    q = q.replace(/^√\s*(\d+)/, (_, n) => `raiz quadrada de ${n}`);

    // Operadores
    q = q.replace(/\s*x\s*/g, ' vezes ');
    q = q.replace(/\s*\+\s*/g, ' mais ');
    q = q.replace(/\s*-\s*/g, ' menos ');
    q = q.replace(/\s*÷\s*/g, ' dividido por ');

    return `Qual é o resultado de ${q}?`;
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
            // Tabuadas mais altas no nível avançado
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
            // Exibição padrão escolar: base com expoente (ex.: 2³)
            questionString = `${num1}${toSuperscript(num2)}`;
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

    // Reseta alertas/flags do timer
    gameState.lowTimeAlertPlayed = false;
    gameState.lastAlertSoundAt = 0;

    // Sai de qualquer modo especial
    gameState.isErrorTraining = false;
    gameState.trainingQueue = [];
    gameState.totalTraining = 0;

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
    // --- Treinamento de Erros (modo especial) ---
    if (gameState.isErrorTraining) {
        if (!gameState.trainingQueue || gameState.trainingQueue.length === 0) {
            finishErrorTraining();
            return;
        }

        gameState.questionNumber++;

        const err = gameState.trainingQueue.shift();
        const newQ = buildQuestionFromSavedError(err);
        gameState.currentQuestion = newQ;

        questionCounter.textContent = `Questão: ${gameState.questionNumber}/${gameState.totalTraining}`;
        questionText.textContent = newQ.question;

        answerOptions.forEach((btn, index) => {
            btn.querySelector('.answer-text').textContent = newQ.options[index];
            btn.classList.remove('correct', 'wrong');
            btn.disabled = false;
        });

        speak(`Questão ${gameState.questionNumber}. ${questionToSpeech(newQ.question)}`);
        return;
    }

    // --- Jogo normal ---
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
        btn.querySelector('.answer-text').textContent = newQ.options[index];
        btn.classList.remove('correct', 'wrong');
        btn.disabled = false;
    });

    // 4. Leitura de Voz (mais natural)
    speak(`Questão ${gameState.questionNumber}. ${questionToSpeech(newQ.question)}`);
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

    // Desabilita todos os botões de resposta após o clique
    answerOptions.forEach(btn => btn.disabled = true);

    // Destaques visuais
    if (isCorrect) {
        selectedButton.classList.add('correct');
    } else {
        selectedButton.classList.add('wrong');
    }

    // Revela a resposta correta em verde
    answerOptions.forEach(btn => {
        if (parseInt(btn.querySelector('.answer-text').textContent) === gameState.currentQuestion.answer) {
            btn.classList.add('correct');
        }
    });

    // --- Treinamento de Erros: não penaliza XP e remove erro quando acertar ---
    if (gameState.isErrorTraining) {
        if (isCorrect) {
            gameState.acertos++;
            if (gameState.currentQuestion.sourceTimestamp) {
                removeSavedErrorByTimestamp(gameState.currentQuestion.sourceTimestamp);
            }
            showFeedbackMessage('Correto! Esse erro foi removido da sua lista ✅', 'success', 2500);
        } else {
            gameState.erros++;
            showFeedbackMessage('Ainda não. Vamos continuar treinando 🙂', 'warning', 2500);
        }

        setTimeout(() => nextQuestion(), 1200);
        return;
    }

    // --- Jogo normal ---
    const feedbackText = isCorrect ? 'RESPOSTA CORRETA!' : 'RESPOSTA INCORRETA!';

    if (isCorrect) {
        gameState.acertos++;
        const scoreGain = gameState.isRapidMode ? 20 * gameState.questionNumber : 10;
        const xpGain = gameState.isRapidMode ? 5 : 2;

        gameState.score += scoreGain;
        atualizarXP(xpGain);
        playerScoreElement.textContent = `${gameState.score} Pontos`;
        showFeedbackMessage(feedbackText, 'success');
    } else {
        gameState.erros++;
        atualizarXP(-2);
        saveError(gameState.currentQuestion, selectedAnswer);
        showFeedbackMessage(feedbackText, 'warning');
    }

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


    // 3. Tenta registrar recorde (ranking)
    tryAddHighScore();

    // 4. Mudar para a tela de resultado
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
            playAlertSound(true);
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
            if (percentage < 10 && !gameState.lowTimeAlertPlayed) {
                playAlertSound();
                gameState.lowTimeAlertPlayed = true;
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
        const isTraining = gameState.isErrorTraining;
        const cost = isTraining ? 0 : 250;

        if (!isTraining && gameState.xp < cost) {
            showFeedbackMessage(`XP insuficiente. Você precisa de ${cost} XP!`, 'error');
            return;
        }

        if (!isTraining) atualizarXP(-cost);

        // Mostra a resposta correta e desabilita os botões para forçar o avanço
        answerOptions.forEach(btn => {
            const answerElement = btn.querySelector('.answer-text');
            if (parseInt(answerElement.textContent) === gameState.currentQuestion.answer) {
                btn.classList.add('correct');
            }
            btn.disabled = true;
        });

        stopTimer();

        const msg = isTraining
            ? `A resposta correta é ${gameState.currentQuestion.answer}.`
            : `A resposta correta era ${gameState.currentQuestion.answer}. Treine mais!`;

        showFeedbackMessage(msg, 'warning', 3000);

        // Avança para a próxima questão após 2,5s
        setTimeout(() => {
            if (gameState.isRapidMode) startTimer();
            nextQuestion();
        }, 2500);
    });
    
    // 10. Navegação para Ranking e Erros
    if (btnShowRanking) {
        btnShowRanking.addEventListener('click', () => {
            renderRanking();
            exibirTela('ranking-screen');
        });
    }

    if (btnClearRanking) {
        btnClearRanking.addEventListener('click', () => {
            if (confirm('Tem certeza que deseja limpar o ranking?')) {
                gameState.highScores = [];
                salvarRanking();
                renderRanking();
                showFeedbackMessage('Ranking limpo com sucesso!', 'info', 2500);
            }
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

    // Iniciar Treinamento de Erros
    if (btnStartTraining) {
        btnStartTraining.addEventListener('click', () => {
            if (!gameState.errors || gameState.errors.length === 0) {
                showFeedbackMessage('Nenhum erro salvo para treinar ainda.', 'info', 2500);
                return;
            }

            // Configura modo de treino
            gameState.isErrorTraining = true;
            gameState.trainingQueue = [...gameState.errors]; // treina os mais recentes primeiro
            gameState.totalTraining = gameState.trainingQueue.length;

            gameState.isGameActive = true;
            gameState.score = 0;
            gameState.questionNumber = 0;
            gameState.acertos = 0;
            gameState.erros = 0;

            // Treino sem tempo
            const timeContainer = timeBar.parentElement;
            timeContainer.style.display = 'none';
            btnExtendTime.style.display = 'none';
            btnShowAnswer.style.display = 'block';

            playerScoreElement.textContent = `Treino de Erros`;

            exibirTela('game-screen');
            nextQuestion();
        });
    }


    // Inicialização final
    exibirTela(gameState.currentScreen);

}


// --- INICIALIZAÇÃO DO DOCUMENTO ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Carrega o estado persistente
    carregarXP();
    carregarErros(); 
    carregarRanking();
    
    // 2. Anexa todos os listeners
    attachEventListeners();
    
    // 3. Atualiza o estado inicial do botão de Treinar Erros
    updateErrorTrainingButton();

    // Aplica o Dark Mode se o body já tiver a classe
    if (document.body.classList.contains('dark-mode')) {
        toggleNightMode.querySelector('.icon').textContent = '☀️';
    }
});