(function () {
  let studentClient = null;
  let teacherClient = null;
  let authSubscription = null;
  let teacherAuthSubscription = null;

  function isConfigured() {
    return !!(window.PETConfig && window.PETConfig.supabaseUrl && window.PETConfig.supabaseAnonKey && window.supabase && typeof window.supabase.createClient === 'function');
  }

  function getRecoveryScopeFromUrl() {
    try {
      const url = new URL(window.location.href);
      const searchScope = String(url.searchParams.get('pet_recovery_scope') || '').trim().toLowerCase();
      if (searchScope === 'teacher') return 'teacher';
      const hash = String(url.hash || '').toLowerCase();
      if (hash.includes('type=recovery') && searchScope === 'teacher') return 'teacher';
      return 'student';
    } catch (_) {
      return 'student';
    }
  }

  function buildClient(storageKey, detectSessionInUrl) {
    return window.supabase.createClient(window.PETConfig.supabaseUrl, window.PETConfig.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: !!detectSessionInUrl,
        storageKey
      }
    });
  }

  function getClient() {
    if (!isConfigured()) return null;
    if (studentClient) return studentClient;
    studentClient = buildClient('pet_student_auth_v1', getRecoveryScopeFromUrl() !== 'teacher');
    return studentClient;
  }

  function getTeacherClient() {
    if (!isConfigured()) return null;
    if (teacherClient) return teacherClient;
    teacherClient = buildClient('pet_teacher_auth_v1', getRecoveryScopeFromUrl() === 'teacher');
    return teacherClient;
  }

  function getRecoveryRedirectUrl(scope) {
    const safeScope = String(scope || 'student').trim().toLowerCase() === 'teacher' ? 'teacher' : 'student';
    try {
      const url = new URL(window.location.href);
      if (safeScope === 'teacher') url.searchParams.set('pet_recovery_scope', 'teacher');
      else url.searchParams.delete('pet_recovery_scope');
      url.hash = 'type=recovery';
      return url.toString();
    } catch (_) {
      return window.location.href;
    }
  }

  async function signUpWithEmail(email, password) {
    const supabaseClient = getClient();
    if (!supabaseClient) return { data: null, error: new Error('Supabase não configurado.') };
    return supabaseClient.auth.signUp({
      email: String(email || '').trim(),
      password: String(password || ''),
      options: {
        emailRedirectTo: window.location.href
      }
    });
  }

  async function signInWithEmail(email, password) {
    const supabaseClient = getClient();
    if (!supabaseClient) return { data: null, error: new Error('Supabase não configurado.') };
    return supabaseClient.auth.signInWithPassword({
      email: String(email || '').trim(),
      password: String(password || '')
    });
  }

  async function requestPasswordReset(email) {
    const supabaseClient = getClient();
    if (!supabaseClient) return { data: null, error: new Error('Supabase não configurado.') };
    return supabaseClient.auth.resetPasswordForEmail(String(email || '').trim(), {
      redirectTo: getRecoveryRedirectUrl('student')
    });
  }

  async function updatePassword(password) {
    const supabaseClient = getClient();
    if (!supabaseClient) return { data: null, error: new Error('Supabase não configurado.') };
    return supabaseClient.auth.updateUser({
      password: String(password || '')
    });
  }

  async function signOut() {
    const supabaseClient = getClient();
    if (!supabaseClient) return { error: null };
    return supabaseClient.auth.signOut();
  }

  async function getSession() {
    const supabaseClient = getClient();
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function getUser() {
    const supabaseClient = getClient();
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) throw error;
    return data.user || null;
  }

  function onAuthStateChange(callback) {
    const supabaseClient = getClient();
    if (!supabaseClient || typeof callback !== 'function') return () => {};
    const { data } = supabaseClient.auth.onAuthStateChange((event, session) => {
      try {
        callback(session, event);
      } catch (_) {}
    });
    if (authSubscription && typeof authSubscription.unsubscribe === 'function') {
      try { authSubscription.unsubscribe(); } catch (_) {}
    }
    authSubscription = data && data.subscription ? data.subscription : null;
    return () => {
      try {
        authSubscription?.unsubscribe?.();
      } catch (_) {}
    };
  }

  async function signUpTeacherWithEmail(email, password) {
    const supabaseClient = getTeacherClient();
    if (!supabaseClient) return { data: null, error: new Error('Supabase não configurado.') };
    return supabaseClient.auth.signUp({
      email: String(email || '').trim(),
      password: String(password || ''),
      options: {
        emailRedirectTo: window.location.href
      }
    });
  }

  async function signInTeacherWithEmail(email, password) {
    const supabaseClient = getTeacherClient();
    if (!supabaseClient) return { data: null, error: new Error('Supabase não configurado.') };
    return supabaseClient.auth.signInWithPassword({
      email: String(email || '').trim(),
      password: String(password || '')
    });
  }

  async function requestTeacherPasswordReset(email) {
    const supabaseClient = getTeacherClient();
    if (!supabaseClient) return { data: null, error: new Error('Supabase não configurado.') };
    return supabaseClient.auth.resetPasswordForEmail(String(email || '').trim(), {
      redirectTo: getRecoveryRedirectUrl('teacher')
    });
  }

  async function updateTeacherPassword(password) {
    const supabaseClient = getTeacherClient();
    if (!supabaseClient) return { data: null, error: new Error('Supabase não configurado.') };
    return supabaseClient.auth.updateUser({
      password: String(password || '')
    });
  }

  async function signOutTeacher() {
    const supabaseClient = getTeacherClient();
    if (!supabaseClient) return { error: null };
    return supabaseClient.auth.signOut();
  }

  async function getTeacherSession() {
    const supabaseClient = getTeacherClient();
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function getTeacherUser() {
    const supabaseClient = getTeacherClient();
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) throw error;
    return data.user || null;
  }

  function onTeacherAuthStateChange(callback) {
    const supabaseClient = getTeacherClient();
    if (!supabaseClient || typeof callback !== 'function') return () => {};
    const { data } = supabaseClient.auth.onAuthStateChange((event, session) => {
      try {
        callback(session, event);
      } catch (_) {}
    });
    if (teacherAuthSubscription && typeof teacherAuthSubscription.unsubscribe === 'function') {
      try { teacherAuthSubscription.unsubscribe(); } catch (_) {}
    }
    teacherAuthSubscription = data && data.subscription ? data.subscription : null;
    return () => {
      try {
        teacherAuthSubscription?.unsubscribe?.();
      } catch (_) {}
    };
  }

  window.PETAuth = {
    isConfigured,
    getClient,
    getTeacherClient,
    signUpWithEmail,
    signInWithEmail,
    requestPasswordReset,
    updatePassword,
    signOut,
    getSession,
    getUser,
    onAuthStateChange,
    signUpTeacherWithEmail,
    signInTeacherWithEmail,
    requestTeacherPasswordReset,
    updateTeacherPassword,
    signOutTeacher,
    getTeacherSession,
    getTeacherUser,
    onTeacherAuthStateChange,
    getRecoveryRedirectUrl,
    getRecoveryScopeFromUrl
  };
})();
