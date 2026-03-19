(function () {
  function readLocalProfile(deviceProfileId, fallbackToActive = true) {
    const id = deviceProfileId || (fallbackToActive && window.PETLocalDriver.getActiveProfileId ? window.PETLocalDriver.getActiveProfileId() : null);
    if (!id) return null;
    return window.PETLocalDriver.readLocalProfile(id, { name: '', turma: '', escola: '' });
  }

  function getCloudLinkInfo(deviceProfileId) {
    if (!deviceProfileId || !window.PETLocalDriver || !window.PETLocalDriver.getCloudLinkInfo) return null;
    return window.PETLocalDriver.getCloudLinkInfo(deviceProfileId);
  }

  async function resolveCloudAccess(deviceProfileId) {
    if (!deviceProfileId) return { ok: false, reason: 'missing-profile' };
    if (!window.PETAuth || !window.PETCloudDriver) return { ok: false, reason: 'unavailable' };
    const session = await window.PETAuth.getSession();
    if (!session || !session.user) return { ok: false, reason: 'no-session' };
    const currentAuthUserId = String(session.user.id || '').trim();
    const currentEmail = String(session.user.email || '').trim();
    const linkInfo = getCloudLinkInfo(deviceProfileId);
    if (!linkInfo || !linkInfo.studentProfileId) {
      return { ok: false, reason: 'unlinked', currentAuthUserId, currentEmail, linkInfo: null };
    }
    if (linkInfo.authUserId && linkInfo.authUserId !== currentAuthUserId) {
      return { ok: false, reason: 'mismatch', currentAuthUserId, currentEmail, linkInfo };
    }
    if (!linkInfo.authUserId) {
      const currentStudent = await window.PETCloudDriver.getStudentProfileForCurrentUser();
      if (!currentStudent || String(currentStudent.id || '') !== String(linkInfo.studentProfileId || '')) {
        return { ok: false, reason: 'mismatch', currentAuthUserId, currentEmail, linkInfo };
      }
      const normalized = window.PETLocalDriver.setCloudLink(deviceProfileId, currentStudent.id, {
        authUserId: currentAuthUserId,
        email: currentEmail,
        linkedAt: linkInfo.linkedAt || new Date().toISOString(),
        lastSeenAt: new Date().toISOString()
      });
      return { ok: true, currentAuthUserId, currentEmail, linkInfo: normalized, studentProfileId: currentStudent.id };
    }
    return { ok: true, currentAuthUserId, currentEmail, linkInfo, studentProfileId: linkInfo.studentProfileId };
  }

  async function ensureCloudLinked(deviceProfileId, localProfile, options = {}) {
    if (!deviceProfileId) return null;
    const access = await resolveCloudAccess(deviceProfileId);
    if (access.ok) {
      const linked = await window.PETCloudDriver.ensureStudentProfile(localProfile || readLocalProfile(deviceProfileId, false), deviceProfileId);
      window.PETLocalDriver.setCloudLink(deviceProfileId, linked.id, {
        authUserId: access.currentAuthUserId,
        email: access.currentEmail,
        linkedAt: access.linkInfo && access.linkInfo.linkedAt,
        lastSeenAt: new Date().toISOString()
      });
      return linked;
    }
    if (access.reason === 'mismatch') {
      throw new Error('Este perfil local já está vinculado a outra conta online. Saia da conta atual e entre com a conta correta do estudante.');
    }
    if (access.reason === 'unlinked' && options && options.explicitLink) {
      const linked = await window.PETCloudDriver.ensureStudentProfile(localProfile || readLocalProfile(deviceProfileId, false), deviceProfileId);
      window.PETLocalDriver.setCloudLink(deviceProfileId, linked.id, {
        authUserId: access.currentAuthUserId,
        email: access.currentEmail,
        linkedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString()
      });
      return linked;
    }
    return null;
  }

  function readLocalSnapshot(deviceProfileId, fallbackToActive = true) {
    const id = deviceProfileId || (fallbackToActive && window.PETLocalDriver.getActiveProfileId ? window.PETLocalDriver.getActiveProfileId() : null);
    if (!id) return {};
    return window.PETLocalDriver.readLocalProgress(id, {});
  }

  function writeLocalSnapshot(deviceProfileId, payload) {
    if (!deviceProfileId) return false;
    return window.PETLocalDriver.writeLocalProgress(deviceProfileId, payload || {});
  }

  async function queueProgressSync(deviceProfileId, snapshot) {
    if (!deviceProfileId) return null;
    return window.PETLocalDriver.enqueue({
      type: 'progress',
      deviceProfileId,
      payload: snapshot || {}
    });
  }

  function readLocalHistory(deviceProfileId, fallbackToActive = true) {
    const id = deviceProfileId || (fallbackToActive && window.PETLocalDriver.getActiveProfileId ? window.PETLocalDriver.getActiveProfileId() : null);
    if (!id) return [];
    return window.PETLocalDriver.readLocalSessionHistory(id, []);
  }

  function writeLocalHistory(deviceProfileId, history) {
    if (!deviceProfileId) return false;
    return window.PETLocalDriver.writeLocalSessionHistory(deviceProfileId, Array.isArray(history) ? history : []);
  }

  async function queueSessionSync(deviceProfileId, sessionEntry) {
    if (!deviceProfileId) return null;
    return window.PETLocalDriver.enqueue({
      type: 'session',
      deviceProfileId,
      payload: sessionEntry || {}
    });
  }

  async function queueAttemptSync(deviceProfileId, attemptEntry) {
    if (!deviceProfileId) return null;
    return window.PETLocalDriver.enqueue({
      type: 'attempt',
      deviceProfileId,
      payload: attemptEntry || {}
    });
  }

  window.PETRepositories = {
    profiles: {
      readLocal: readLocalProfile,
      getCloudLinkInfo,
      resolveCloudAccess,
      ensureCloudLinked
    },
    progress: {
      readLocalSnapshot,
      writeLocalSnapshot,
      queueSync: queueProgressSync
    },
    sessions: {
      readLocal: readLocalHistory,
      writeLocal: writeLocalHistory,
      queueSync: queueSessionSync
    },
    attempts: {
      queueSync: queueAttemptSync
    }
  };
})();
