(function () {
  function notReady() {
    return !window.PETAuth || !window.PETAuth.isConfigured || !window.PETAuth.isConfigured();
  }

  async function requireClient() {
    if (notReady()) throw new Error('Supabase não configurado.');
    const client = window.PETAuth.getClient();
    if (!client) throw new Error('Cliente Supabase indisponível.');
    return client;
  }

  function normalizeStudentMeta(localProfile, user) {
    const safe = localProfile && typeof localProfile === 'object' ? localProfile : {};
    const fallbackName = (user?.user_metadata?.display_name || user?.user_metadata?.name || user?.email || 'Aluno').split('@')[0];
    const grade = Number.parseInt(String(safe.gradeYear || safe.ano || '').replace(/\D/g, ''), 10);
    return {
      display_name: String(safe.name || safe.display_name || fallbackName).trim().slice(0, 120) || 'Aluno',
      turma_label: String(safe.turma || safe.turma_label || '').trim().slice(0, 120),
      school_name: String(safe.escola || safe.school_name || '').trim().slice(0, 180),
      grade_year: Number.isFinite(grade) ? grade : null,
      avatar_url: String(safe.avatar || safe.avatar_url || '').trim().slice(0, 500),
      active: true
    };
  }

  function mapSnapshotToProgress(snapshot) {
    const safe = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const currentSession = safe.currentSession && typeof safe.currentSession === 'object' ? safe.currentSession : null;
    const currentSessionIso = currentSession && Number(currentSession.savedAt || currentSession.startedAt || currentSession.questionStartedAt)
      ? new Date(Number(currentSession.savedAt || currentSession.startedAt || currentSession.questionStartedAt)).toISOString()
      : null;
    const lastPlayedAt = safe.lastPlayedAt || safe.last_played_at || currentSessionIso || (safe.lastStudyDate ? new Date(`${safe.lastStudyDate}T12:00:00`).toISOString() : null);
    return {
      total_xp: Math.max(0, Number(safe.totalXP ?? safe.total_xp ?? safe.xp ?? 0) || 0),
      streak: Math.max(0, Number(safe.streak ?? 0) || 0),
      best_streak: Math.max(0, Number(safe.bestStreak ?? safe.best_streak ?? safe.streak ?? 0) || 0),
      total_sessions: Math.max(0, Number(safe.totalSessions ?? safe.total_sessions ?? 0) || 0),
      total_answered: Math.max(0, Number(safe.totalAnswered ?? safe.total_answered ?? 0) || 0),
      last_played_at: lastPlayedAt || null,
      operation_progress: safe.operationProgress || safe.operation_progress || {},
      achievements: Array.isArray(safe.achievements) ? safe.achievements : (safe.badges || []),
      settings: safe.settings || {},
      snapshot: safe
    };
  }

  function mapSessionPayload(studentProfileId, payload) {
    const safe = payload && typeof payload === 'object' ? payload : {};
    const endedIso = safe.endedAt ? new Date(Number(safe.endedAt)).toISOString() : new Date().toISOString();
    const startedIso = safe.startedAt ? new Date(Number(safe.startedAt)).toISOString() : endedIso;
    const durationSeconds = Number.isFinite(Number(safe.duration_seconds))
      ? Number(safe.duration_seconds)
      : Math.max(0, Math.round(Number((safe.avgSec || 0)) * Math.max(1, Number(safe.answered || 0))));
    return {
      student_profile_id: studentProfileId,
      client_session_id: String(safe.clientSessionId || safe.sessionKey || safe.id || `${safe.operation || 'sessao'}-${safe.endedAt || Date.now()}`),
      operation: String(safe.operation || '').trim(),
      level_name: String(safe.level || safe.levelLabel || '').trim(),
      mode: String(safe.mode || '').trim() || 'study',
      stage_no: Number.isFinite(Number(safe.stageNo)) ? Number(safe.stageNo) : null,
      stage_label: String(safe.stageLabel || '').trim(),
      started_at: startedIso,
      ended_at: endedIso,
      duration_seconds: durationSeconds,
      answered: Math.max(0, Number(safe.answered || 0) || 0),
      correct_count: Math.max(0, Number(safe.hits || safe.correct_count || 0) || 0),
      wrong_count: Math.max(0, Number(safe.misses || safe.wrong_count || 0) || 0),
      accuracy: Number.isFinite(Number(safe.accuracy)) ? Number(safe.accuracy) : null,
      score: Math.max(0, Number(safe.score || 0) || 0),
      xp_earned: Math.max(0, Number(safe.xpEarned || safe.xp_earned || 0) || 0),
      xp_bonus: Math.max(0, Number(safe.xpBonus || safe.xp_bonus || 0) || 0),
      metadata: safe
    };
  }

  function mapAttemptPayload(studentProfileId, gameSessionId, payload) {
    const safe = payload && typeof payload === 'object' ? payload : {};
    const meta = safe.metadata && typeof safe.metadata === 'object' ? safe.metadata : {};
    return {
      client_attempt_id: String(safe.clientAttemptId || `${safe.clientSessionId || 'sessao'}::${meta.questionSeq || 1}::${meta.attemptNo || 1}`),
      game_session_id: gameSessionId,
      student_profile_id: studentProfileId,
      class_id: safe.classId || null,
      operation: String(safe.operation || '').trim(),
      skill_code: String(safe.skillCode || '').trim(),
      stage_label: String(safe.stageLabel || '').trim(),
      question_text: String(safe.questionText || '').trim(),
      presented_options: Array.isArray(safe.presentedOptions) ? safe.presentedOptions.map((value) => String(value)) : [],
      student_answer: safe.studentAnswer == null ? '' : String(safe.studentAnswer),
      correct: !!safe.correct,
      response_ms: Number.isFinite(Number(safe.responseMs)) ? Math.max(0, Number(safe.responseMs)) : null,
      error_code: String(safe.errorCode || '').trim(),
      metadata: {
        ...meta,
        clientSessionId: String(safe.clientSessionId || ''),
        insertedFrom: 'pet-cloud-driver'
      }
    };
  }

  async function getCurrentUserIdentity() {
    const user = await window.PETAuth.getUser();
    if (!user) return null;
    return {
      authUserId: String(user.id || '').trim(),
      email: String(user.email || '').trim(),
      user
    };
  }

  async function getStudentProfileForCurrentUser() {
    const client = await requireClient();
    const user = await window.PETAuth.getUser();
    if (!user) return null;
    const { data, error } = await client
      .from('student_profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function ensureStudentProfile(localProfile, deviceProfileId) {
    const client = await requireClient();
    const identity = await getCurrentUserIdentity();
    const user = identity && identity.user;
    if (!user) throw new Error('Usuário não autenticado.');

    const payload = {
      auth_user_id: user.id,
      ...normalizeStudentMeta(localProfile, user)
    };

    const { data, error } = await client
      .from('student_profiles')
      .upsert(payload, { onConflict: 'auth_user_id' })
      .select('*')
      .single();
    if (error) throw error;

    if (deviceProfileId) {
      const { error: linkError } = await client
        .from('student_device_links')
        .upsert({
          student_profile_id: data.id,
          device_profile_id: String(deviceProfileId),
          device_label: (window.PETConfig && window.PETConfig.deviceLabel) || 'Navegador',
          last_seen_at: new Date().toISOString()
        }, { onConflict: 'student_profile_id,device_profile_id' });
      if (linkError) throw linkError;
    }

    return data;
  }

  async function fetchStudentProfile(studentProfileId) {
    const client = await requireClient();
    const { data, error } = await client
      .from('student_profiles')
      .select('*')
      .eq('id', studentProfileId)
      .single();
    if (error) throw error;
    return data;
  }

  async function upsertProgress(studentProfileId, snapshot) {
    const client = await requireClient();
    const payload = {
      student_profile_id: studentProfileId,
      ...mapSnapshotToProgress(snapshot)
    };
    const { data, error } = await client
      .from('student_progress')
      .upsert(payload, { onConflict: 'student_profile_id' })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async function fetchProgress(studentProfileId) {
    const client = await requireClient();
    const { data, error } = await client
      .from('student_progress')
      .select('*')
      .eq('student_profile_id', studentProfileId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function insertSession(studentProfileId, payload) {
    const client = await requireClient();
    const row = mapSessionPayload(studentProfileId, payload);
    const { data, error } = await client
      .from('game_sessions')
      .upsert(row, { onConflict: 'client_session_id' })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async function ensureSessionRow(studentProfileId, payload) {
    return insertSession(studentProfileId, payload || {});
  }

  async function insertAttempt(studentProfileId, payload) {
    const client = await requireClient();
    const safe = payload && typeof payload === 'object' ? payload : {};
    const sessionPayload = safe.sessionPayload && typeof safe.sessionPayload === 'object'
      ? safe.sessionPayload
      : {
          id: safe.clientSessionId,
          clientSessionId: safe.clientSessionId,
          operation: safe.operation,
          mode: safe?.metadata?.mode || 'study',
          level: safe?.metadata?.level || '',
          stageLabel: safe.stageLabel || '',
          startedAt: Date.now(),
          endedAt: Date.now(),
          answered: 0,
          hits: 0,
          misses: 0,
          metadata: { source: 'attempt-fallback-session' }
        };
    const sessionRow = await ensureSessionRow(studentProfileId, sessionPayload);
    const row = mapAttemptPayload(studentProfileId, sessionRow.id, safe);
    const { data, error } = await client
      .from('attempts')
      .upsert(row, { onConflict: 'client_attempt_id' })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async function fetchRecentSessions(studentProfileId, limit = 25) {
    const client = await requireClient();
    const { data, error } = await client
      .from('game_sessions')
      .select('*')
      .eq('student_profile_id', studentProfileId)
      .order('ended_at', { ascending: false })
      .limit(Math.max(1, Number(limit) || 25));
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  function normalizeTeacherMeta(input, user) {
    const safe = input && typeof input === 'object' ? input : {};
    const fallbackName = String(safe.full_name || safe.display_name || user?.user_metadata?.display_name || user?.user_metadata?.name || user?.email || 'Professor').trim();
    return {
      full_name: fallbackName.slice(0, 160) || 'Professor',
      school_name: String(safe.school_name || safe.escola || '').trim().slice(0, 180),
      turma_label: String(safe.turma_label || safe.turma || '').trim().slice(0, 120),
      email: String(safe.email || user?.email || '').trim().slice(0, 180),
      active: true
    };
  }

  async function requireTeacherClient() {
    if (notReady()) throw new Error('Supabase não configurado.');
    const client = window.PETAuth.getTeacherClient && window.PETAuth.getTeacherClient();
    if (!client) throw new Error('Cliente Supabase do professor indisponível.');
    return client;
  }

  async function getTeacherCurrentUserIdentity() {
    const user = await window.PETAuth.getTeacherUser();
    if (!user) return null;
    return {
      authUserId: String(user.id || '').trim(),
      email: String(user.email || '').trim(),
      user
    };
  }

  async function registerTeacherAccess(payload) {
    const client = await requireTeacherClient();
    const identity = await getTeacherCurrentUserIdentity();
    const user = identity && identity.user;
    if (!user) throw new Error('Professor não autenticado.');
    const safe = normalizeTeacherMeta(payload, user);
    const { data, error } = await client.rpc('register_teacher_access', {
      p_full_name: safe.full_name,
      p_school_name: safe.school_name,
      p_turma_label: safe.turma_label,
      p_email: safe.email || String(user.email || '').trim()
    });
    if (error) throw error;
    return data || null;
  }

  async function fetchTeacherProfileForCurrentUser() {
    const client = await requireTeacherClient();
    const user = await window.PETAuth.getTeacherUser();
    if (!user) return null;
    const { data, error } = await client
      .from('teacher_profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  window.PETCloudDriver = {
    normalizeStudentMeta,
    normalizeTeacherMeta,
    mapSnapshotToProgress,
    mapAttemptPayload,
    getCurrentUserIdentity,
    getTeacherCurrentUserIdentity,
    getStudentProfileForCurrentUser,
    ensureStudentProfile,
    fetchStudentProfile,
    registerTeacherAccess,
    fetchTeacherProfileForCurrentUser,
    upsertProgress,
    fetchProgress,
    insertSession,
    ensureSessionRow,
    insertAttempt,
    fetchRecentSessions
  };
})();
