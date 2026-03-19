(function () {
  const PROFILE_STORAGE_KEY = 'matemagica_profile_v1';
  const PET_PROGRESS_KEY = 'pet_progress_v1';
  const PET_SESSION_KEY = 'pet_session_v1';
  const PET_SESSION_HISTORY_KEY = 'pet_session_history_v1';
  const PROFILE_ACTIVE_KEY = 'pet_active_profile_id_v1';
  const PROFILE_SCOPE_PREFIX = 'pet_profile';
  const PROFILE_GUEST_ID = '__guest__';
  const PROFILE_GUEST_PREFIX = 'pet_guest';
  const QUEUE_KEY = (window.PETConfig && window.PETConfig.queueKey) || 'pet_sync_queue_v1';
  const CLOUD_LINK_MAP_KEY = (window.PETConfig && window.PETConfig.cloudLinkMapKey) || 'pet_cloud_link_map_v1';

  function safeJsonParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function getDriverForProfile(profileId) {
    return profileId === PROFILE_GUEST_ID ? sessionStorage : localStorage;
  }

  function getScopedKey(baseKey, profileId) {
    if (!profileId) return baseKey;
    return profileId === PROFILE_GUEST_ID
      ? `${PROFILE_GUEST_PREFIX}::${baseKey}`
      : `${PROFILE_SCOPE_PREFIX}::${profileId}::${baseKey}`;
  }

  function readJsonScoped(baseKey, profileId, fallback) {
    try {
      const raw = getDriverForProfile(profileId).getItem(getScopedKey(baseKey, profileId));
      return safeJsonParse(raw, fallback);
    } catch (_) {
      return fallback;
    }
  }

  function writeJsonScoped(baseKey, profileId, value) {
    try {
      getDriverForProfile(profileId).setItem(getScopedKey(baseKey, profileId), JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function writeTextScoped(baseKey, profileId, value) {
    try {
      getDriverForProfile(profileId).setItem(getScopedKey(baseKey, profileId), String(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function removeScoped(baseKey, profileId) {
    try {
      getDriverForProfile(profileId).removeItem(getScopedKey(baseKey, profileId));
      return true;
    } catch (_) {
      return false;
    }
  }

  function getActiveProfileId() {
    try {
      return String(localStorage.getItem(PROFILE_ACTIVE_KEY) || '').trim() || null;
    } catch (_) {
      return null;
    }
  }

  function isGuest(profileId) {
    return !profileId || profileId === PROFILE_GUEST_ID;
  }

  function readLocalProfile(deviceProfileId, fallback = null) {
    return readJsonScoped(PROFILE_STORAGE_KEY, deviceProfileId, fallback || { name: '', turma: '', escola: '' });
  }

  function readLocalProgress(deviceProfileId, fallback = null) {
    return readJsonScoped(PET_PROGRESS_KEY, deviceProfileId, fallback || {});
  }

  function readLocalGameSnapshot(deviceProfileId, fallback = null) {
    return readJsonScoped(PET_SESSION_KEY, deviceProfileId, fallback || null);
  }

  function readLocalSessionHistory(deviceProfileId, fallback = null) {
    const out = readJsonScoped(PET_SESSION_HISTORY_KEY, deviceProfileId, fallback || []);
    return Array.isArray(out) ? out : [];
  }

  function writeLocalProfile(deviceProfileId, payload) {
    return writeJsonScoped(PROFILE_STORAGE_KEY, deviceProfileId, payload || {});
  }

  function writeLocalProgress(deviceProfileId, payload) {
    return writeJsonScoped(PET_PROGRESS_KEY, deviceProfileId, payload || {});
  }

  function writeLocalGameSnapshot(deviceProfileId, payload) {
    if (!payload) return removeScoped(PET_SESSION_KEY, deviceProfileId);
    return writeJsonScoped(PET_SESSION_KEY, deviceProfileId, payload || {});
  }

  function writeLocalSessionHistory(deviceProfileId, payload) {
    return writeJsonScoped(PET_SESSION_HISTORY_KEY, deviceProfileId, Array.isArray(payload) ? payload : []);
  }

  function loadQueue() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      const parsed = safeJsonParse(raw, []);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveQueue(queue) {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(Array.isArray(queue) ? queue : []));
      return true;
    } catch (_) {
      return false;
    }
  }

  function enqueue(item) {
    const queue = loadQueue();
    const record = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      ...item
    };
    queue.push(record);
    saveQueue(queue);
    return record;
  }

  function normalizeCloudLinkRecord(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') {
      const trimmed = entry.trim();
      return trimmed ? { studentProfileId: trimmed } : null;
    }
    if (typeof entry !== 'object') return null;
    const studentProfileId = String(entry.studentProfileId || entry.student_profile_id || entry.id || '').trim();
    if (!studentProfileId) return null;
    return {
      studentProfileId,
      authUserId: String(entry.authUserId || entry.auth_user_id || '').trim(),
      email: String(entry.email || '').trim(),
      linkedAt: String(entry.linkedAt || entry.linked_at || '').trim(),
      lastSeenAt: String(entry.lastSeenAt || entry.last_seen_at || '').trim()
    };
  }

  function normalizeCloudLinkMap(rawMap) {
    const out = {};
    const safe = rawMap && typeof rawMap === 'object' ? rawMap : {};
    Object.keys(safe).forEach((key) => {
      const normalized = normalizeCloudLinkRecord(safe[key]);
      if (normalized) out[String(key)] = normalized;
    });
    return out;
  }

  function getCloudLinkMap() {
    try {
      const raw = localStorage.getItem(CLOUD_LINK_MAP_KEY);
      const parsed = safeJsonParse(raw, {});
      return normalizeCloudLinkMap(parsed);
    } catch (_) {
      return {};
    }
  }

  function getCloudLinkInfo(deviceProfileId) {
    if (!deviceProfileId) return null;
    const map = getCloudLinkMap();
    return map[String(deviceProfileId)] || null;
  }

  function setCloudLink(deviceProfileId, studentProfileId, meta) {
    if (!deviceProfileId || !studentProfileId) return null;
    const map = getCloudLinkMap();
    map[String(deviceProfileId)] = normalizeCloudLinkRecord({
      studentProfileId,
      authUserId: meta && meta.authUserId,
      email: meta && meta.email,
      linkedAt: meta && meta.linkedAt || new Date().toISOString(),
      lastSeenAt: meta && meta.lastSeenAt || new Date().toISOString()
    });
    try {
      localStorage.setItem(CLOUD_LINK_MAP_KEY, JSON.stringify(map));
    } catch (_) {}
    return map[String(deviceProfileId)];
  }

  function clearCloudLink(deviceProfileId) {
    const map = getCloudLinkMap();
    delete map[String(deviceProfileId || '')];
    try {
      localStorage.setItem(CLOUD_LINK_MAP_KEY, JSON.stringify(map));
    } catch (_) {}
    return map;
  }

  window.PETLocalDriver = {
    PROFILE_STORAGE_KEY,
    PET_PROGRESS_KEY,
    PET_SESSION_KEY,
    PET_SESSION_HISTORY_KEY,
    PROFILE_ACTIVE_KEY,
    PROFILE_GUEST_ID,
    safeJsonParse,
    getActiveProfileId,
    isGuest,
    getScopedKey,
    readJsonScoped,
    writeJsonScoped,
    writeTextScoped,
    removeScoped,
    readLocalProfile,
    readLocalProgress,
    readLocalGameSnapshot,
    readLocalSessionHistory,
    writeLocalProfile,
    writeLocalProgress,
    writeLocalGameSnapshot,
    writeLocalSessionHistory,
    loadQueue,
    saveQueue,
    enqueue,
    normalizeCloudLinkRecord,
    getCloudLinkMap,
    getCloudLinkInfo,
    setCloudLink,
    clearCloudLink
  };
})();
