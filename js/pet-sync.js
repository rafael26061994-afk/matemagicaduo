(function () {
  async function syncNow() {
    if (!window.PETLocalDriver || !window.PETAuth || !window.PETCloudDriver || !window.PETRepositories) {
      return { processed: 0, failed: 0, mode: 'unavailable' };
    }
    if (!window.PETAuth.isConfigured || !window.PETAuth.isConfigured()) {
      return { processed: 0, failed: 0, mode: 'not-configured' };
    }
    const session = await window.PETAuth.getSession();
    if (!session) {
      return { processed: 0, failed: 0, mode: 'local-only-no-session' };
    }

    const queue = window.PETLocalDriver.loadQueue();
    if (!queue.length) return { processed: 0, failed: 0, mode: 'empty' };

    const remaining = [];
    let processed = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        const deviceProfileId = String(item.deviceProfileId || '');
        const localProfile = window.PETLocalDriver.readLocalProfile(deviceProfileId, { name: '', turma: '', escola: '' });
        const access = await window.PETRepositories.profiles.resolveCloudAccess(deviceProfileId);
        if (!access.ok) {
          throw new Error(access.reason === 'mismatch'
            ? 'Este perfil local está vinculado a outra conta online neste dispositivo.'
            : 'Perfil local ainda não vinculado à conta online do estudante.');
        }
        const linked = await window.PETRepositories.profiles.ensureCloudLinked(deviceProfileId, localProfile, { explicitLink: false });
        if (!linked) throw new Error('Perfil local ainda não vinculado à conta online do estudante.');
        if (item.type === 'progress') {
          await window.PETCloudDriver.upsertProgress(linked.id, item.payload || {});
        } else if (item.type === 'session') {
          await window.PETCloudDriver.insertSession(linked.id, item.payload || {});
        } else if (item.type === 'attempt') {
          await window.PETCloudDriver.insertAttempt(linked.id, item.payload || {});
        }
        processed += 1;
      } catch (err) {
        failed += 1;
        remaining.push({
          ...item,
          lastError: String(err?.message || err || 'erro desconhecido'),
          retries: Math.max(0, Number(item.retries || 0)) + 1,
          lastTriedAt: new Date().toISOString()
        });
      }
    }

    window.PETLocalDriver.saveQueue(remaining);
    return { processed, failed, mode: 'done', pending: remaining.length };
  }

  window.addEventListener('online', () => {
    const delay = (window.PETConfig && window.PETConfig.syncThrottleMs) || 1500;
    window.setTimeout(() => {
      syncNow().catch(() => {});
    }, delay);
  });

  window.PETSync = {
    syncNow
  };
})();
