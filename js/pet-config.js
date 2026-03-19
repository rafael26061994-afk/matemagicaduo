(function () {
  const config = {
    supabaseUrl: '',
    supabaseAnonKey: '',
    cloudEnabled: false,
    queueKey: 'pet_sync_queue_v1',
    cloudLinkMapKey: 'pet_cloud_link_map_v1',
    syncThrottleMs: 1500,
    recentSessionsBootstrapLimit: 25,
    appVersion: 'supabase-arch-v1',
    deviceLabel: (() => {
      try {
        const ua = navigator.userAgent || '';
        const platform = navigator.platform || '';
        return [platform, ua].filter(Boolean).join(' | ').slice(0, 180);
      } catch (_) {
        return 'Navegador';
      }
    })()
  };

  window.PETConfig = Object.freeze(config);
})();
