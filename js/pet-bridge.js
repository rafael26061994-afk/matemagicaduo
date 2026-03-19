(function () {
  function getActiveProfileContext() {
    const id = window.PETLocalDriver && window.PETLocalDriver.getActiveProfileId
      ? window.PETLocalDriver.getActiveProfileId()
      : null;
    return {
      deviceProfileId: id,
      isGuest: !id || (window.PETLocalDriver && window.PETLocalDriver.isGuest ? window.PETLocalDriver.isGuest(id) : false)
    };
  }

  function extractLocalSnapshotTimestamp(snapshot) {
    const safe = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const direct = safe.updatedAt || safe.updated_at || safe.lastCloudSyncAt || safe.last_played_at || null;
    if (direct) {
      const ts = Date.parse(direct);
      if (Number.isFinite(ts)) return ts;
    }
    const currentSession = safe.currentSession && typeof safe.currentSession === 'object' ? safe.currentSession : null;
    if (currentSession) {
      const currentSessionTs = Number(currentSession.savedAt || currentSession.startedAt || currentSession.questionStartedAt || 0);
      if (Number.isFinite(currentSessionTs) && currentSessionTs > 0) return currentSessionTs;
    }
    if (safe.lastStudyDate) {
      const ts = Date.parse(`${safe.lastStudyDate}T12:00:00`);
      if (Number.isFinite(ts)) return ts;
    }
    return 0;
  }

  function mergeRemoteSessionsIntoLocal(localHistory, remoteRows) {
    const current = Array.isArray(localHistory) ? localHistory.slice() : [];
    const seen = new Set(current.map((item) => String(item?.id || '')));
    const extra = [];
    for (const row of Array.isArray(remoteRows) ? remoteRows : []) {
      const id = String(row?.client_session_id || row?.id || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
      extra.push({
        ...meta,
        id,
        endedAt: row?.ended_at ? Date.parse(row.ended_at) : meta.endedAt,
        startedAt: row?.started_at ? Date.parse(row.started_at) : meta.startedAt
      });
    }
    return current.concat(extra).sort((a, b) => Number(b?.endedAt || 0) - Number(a?.endedAt || 0));
  }

  async function bootstrapCurrentProfileFromCloud() {
    const ctx = getActiveProfileContext();
    if (!ctx.deviceProfileId || ctx.isGuest) return { mode: 'guest-or-missing' };
    if (!window.PETAuth || !window.PETCloudDriver || !window.PETRepositories) return { mode: 'unavailable' };
    const session = await window.PETAuth.getSession();
    if (!session) return { mode: 'local-only-no-session' };

    const access = await window.PETRepositories.profiles.resolveCloudAccess(ctx.deviceProfileId);
    if (!access.ok) {
      return { mode: access.reason || 'local-only-unlinked', access };
    }

    const localProfile = window.PETRepositories.profiles.readLocal(ctx.deviceProfileId, false) || { name: '', turma: '', escola: '' };
    const linked = await window.PETRepositories.profiles.ensureCloudLinked(ctx.deviceProfileId, localProfile, { explicitLink: false });
    if (!linked) return { mode: 'link-failed' };

    const remoteProgress = await window.PETCloudDriver.fetchProgress(linked.id);
    const localSnapshot = window.PETRepositories.progress.readLocalSnapshot(ctx.deviceProfileId, false) || {};

    const remoteTs = remoteProgress?.updated_at ? Date.parse(remoteProgress.updated_at) : 0;
    const localTs = extractLocalSnapshotTimestamp(localSnapshot);

    if (remoteProgress && remoteTs > localTs) {
      const nextProfile = {
        name: linked.display_name || localProfile.name || '',
        turma: linked.turma_label || localProfile.turma || '',
        escola: linked.school_name || localProfile.escola || ''
      };
      window.PETLocalDriver.writeLocalProfile(ctx.deviceProfileId, nextProfile);
      const remoteSnapshot = remoteProgress.snapshot && typeof remoteProgress.snapshot === 'object' ? remoteProgress.snapshot : {};
      window.PETRepositories.progress.writeLocalSnapshot(ctx.deviceProfileId, remoteSnapshot);
      try {
        if (window.PETLocalDriver && window.PETLocalDriver.writeLocalGameSnapshot) {
          if (remoteSnapshot.currentSession && typeof remoteSnapshot.currentSession === 'object' && remoteSnapshot.currentSession.isGameActive) {
            window.PETLocalDriver.writeLocalGameSnapshot(ctx.deviceProfileId, remoteSnapshot.currentSession);
          } else {
            window.PETLocalDriver.writeLocalGameSnapshot(ctx.deviceProfileId, null);
          }
        }
      } catch (_) {}

      try {
        const remoteSessions = await window.PETCloudDriver.fetchRecentSessions(linked.id, (window.PETConfig && window.PETConfig.recentSessionsBootstrapLimit) || 25);
        const localHistory = window.PETRepositories.sessions.readLocal(ctx.deviceProfileId, false);
        const merged = mergeRemoteSessionsIntoLocal(localHistory, remoteSessions);
        window.PETRepositories.sessions.writeLocal(ctx.deviceProfileId, merged);
      } catch (_) {}

      return { mode: 'remote-preferred', remoteTs, localTs, studentProfileId: linked.id };
    }

    return { mode: 'local-preferred', remoteTs, localTs, studentProfileId: linked.id };
  }

  window.PETBridge = {
    getActiveProfileContext,
    bootstrapCurrentProfileFromCloud
  };
})();
