import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Sparkles, X, Check } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface VersionResponse {
  version: string;
  buildTime: number;
  buildHash?: string;
  timestamp?: number;
}

// Running build time and version baked into bundle at build time
const RUNNING_BUILD_TIME = (typeof __APP_BUILD_TIME__ !== 'undefined' && Number(__APP_BUILD_TIME__))
  ? Number(__APP_BUILD_TIME__)
  : 0;

const RUNNING_VERSION = (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__)
  ? __APP_VERSION__
  : '2.5.1';

export default function UpdateNotificationModal() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [latestBuildTime, setLatestBuildTime] = useState<number>(0);
  const [latestVersion, setLatestVersion] = useState<string>(RUNNING_VERSION);
  const isCheckingRef = useRef(false);
  const mountTimeRef = useRef<number>(Date.now());
  const initialFirestoreSnapshotHandledRef = useRef(false);

  // Initialize client's applied build time on mount so that fresh visits or reloads never falsely show the popup
  useEffect(() => {
    try {
      const stored = localStorage.getItem('hbn1_applied_build_time');
      const storedTime = stored ? Number(stored) : 0;
      if (!storedTime || (RUNNING_BUILD_TIME > 0 && storedTime < RUNNING_BUILD_TIME)) {
        localStorage.setItem('hbn1_applied_build_time', String(RUNNING_BUILD_TIME || Date.now()));
        localStorage.setItem('hbn1_applied_version', RUNNING_VERSION);
      }
    } catch (_) {}
  }, []);

  // Check version against client's local acknowledged version and running build
  const evaluateVersion = (serverTime: number, versionStr?: string, source: 'http' | 'firestore' | 'event' = 'http') => {
    if (!serverTime || isNaN(serverTime) || serverTime <= 0) return;

    // 1. Current code running in this browser tab
    // If the server buildTime is less than or equal to what is already executing in this tab, there is NO update.
    if (RUNNING_BUILD_TIME > 0 && serverTime <= RUNNING_BUILD_TIME) {
      setHasUpdate(false);
      return;
    }

    // 2. Last build applied/acknowledged by user
    let lastAppliedTime = RUNNING_BUILD_TIME;
    try {
      const lastAppliedStr = localStorage.getItem('hbn1_applied_build_time');
      if (lastAppliedStr) {
        lastAppliedTime = Math.max(lastAppliedTime, Number(lastAppliedStr));
      }
    } catch (_) {}

    // 3. For Firestore real-time listener:
    // When the listener first connects on mount, it receives whatever document was stored previously.
    // If that document was written BEFORE this browser tab was mounted, it's historical!
    // The user already downloaded the latest files when loading the page.
    if (source === 'firestore') {
      if (serverTime <= mountTimeRef.current || serverTime <= lastAppliedTime) {
        return;
      }
    }

    // 4. Threshold: Only notify if serverTime is genuinely newer than what is currently running
    // (buffer of at least 3000ms to avoid clock skew or sub-second file writing differences)
    const isGenuinelyNewer = serverTime > (lastAppliedTime + 3000);
    const hasNewerVersion = Boolean(versionStr && versionStr !== RUNNING_VERSION && serverTime > lastAppliedTime);

    if (isGenuinelyNewer || hasNewerVersion) {
      console.log(`[UpdateSystem] Nova versão detectada (${source})! Servidor: ${serverTime} (${versionStr}), Executando: ${RUNNING_BUILD_TIME} (${RUNNING_VERSION})`);
      setLatestBuildTime(serverTime);
      if (versionStr) setLatestVersion(versionStr);
      setHasUpdate(true);

      const isDismissedInSession = sessionStorage.getItem('hbn1_update_dismissed_session') === 'true';
      if (isDismissedInSession) {
        setIsMinimized(true);
      }
    } else {
      // Already on latest version
      setHasUpdate(false);
    }
  };

  // Fetch version from server endpoints
  const checkVersion = async () => {
    if (isCheckingRef.current || isUpdating) return;
    isCheckingRef.current = true;

    try {
      const cacheBuster = Date.now();
      let data: VersionResponse | null = null;

      // 1. Try /api/version
      try {
        const res = await fetch(`/api/version?t=${cacheBuster}`, {
          headers: { 'Cache-Control': 'no-cache, no-store' },
          cache: 'no-store'
        });
        if (res.ok) {
          data = await res.json();
        }
      } catch (_) {}

      // 2. Fallback to /version.json if /api/version failed
      if (!data) {
        try {
          const res = await fetch(`/version.json?t=${cacheBuster}`, {
            headers: { 'Cache-Control': 'no-cache, no-store' },
            cache: 'no-store'
          });
          if (res.ok) {
            data = await res.json();
          }
        } catch (_) {}
      }

      if (data && typeof data.buildTime === 'number') {
        evaluateVersion(data.buildTime, data.version, 'http');
      }
    } catch (err) {
      console.debug('[UpdateSystem] Erro ao verificar versão via HTTP:', err);
    } finally {
      isCheckingRef.current = false;
    }
  };

  useEffect(() => {
    // 1. Initial check on mount
    checkVersion();

    // 2. Periodic polling every 30 seconds
    const interval = setInterval(checkVersion, 30000);

    // 3. Listen to real-time broadcast in Firestore (sub-second broadcast across all clients)
    let unsubscribeFirestore: (() => void) | null = null;
    try {
      const versionDocRef = doc(db, 'system_settings', 'app_version');
      unsubscribeFirestore = onSnapshot(versionDocRef, (snapshot) => {
        if (!initialFirestoreSnapshotHandledRef.current) {
          initialFirestoreSnapshotHandledRef.current = true;
          // Initial snapshot on mount: only evaluate if newer than mount time
          if (snapshot.exists()) {
            const data = snapshot.data();
            if (data?.buildTime && Number(data.buildTime) > mountTimeRef.current) {
              evaluateVersion(Number(data.buildTime), data.version, 'firestore');
            }
          }
          return;
        }

        if (snapshot.exists()) {
          const firestoreData = snapshot.data();
          if (firestoreData?.buildTime) {
            console.log('[UpdateSystem] Broadcast Firestore em tempo real recebido:', firestoreData);
            evaluateVersion(Number(firestoreData.buildTime), firestoreData.version || RUNNING_VERSION, 'firestore');
          }
        }
      }, (err) => {
        console.debug('[UpdateSystem] Firestore realtime listener info:', err.message);
      });
    } catch (err) {
      console.debug('[UpdateSystem] Falha ao conectar snapshot Firestore:', err);
    }

    // 4. Custom window event for manual testing or SW notifications
    const handleTrigger = (e: any) => {
      if (e.detail?.buildTime) {
        evaluateVersion(Number(e.detail.buildTime), e.detail.version, 'event');
        setIsMinimized(false);
      } else if (e.detail?.type === 'sw-update') {
        checkVersion();
      }
    };
    window.addEventListener('app-update-available', handleTrigger);

    // 5. Visibility and Focus triggers
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkVersion);

    return () => {
      clearInterval(interval);
      if (unsubscribeFirestore) unsubscribeFirestore();
      window.removeEventListener('app-update-available', handleTrigger);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkVersion);
    };
  }, []);

  const handleApplyUpdate = async () => {
    setIsUpdating(true);

    try {
      const targetTime = latestBuildTime > 0 ? latestBuildTime : Date.now();

      // 1. Mark this build as acknowledged and applied locally
      localStorage.setItem('hbn1_applied_build_time', String(targetTime));
      if (latestVersion) {
        localStorage.setItem('hbn1_applied_version', latestVersion);
      }
      sessionStorage.removeItem('hbn1_update_dismissed_session');

      // 2. Tell Service Worker to activate immediately and skip waiting
      if (typeof (window as any).__updateSW === 'function') {
        try {
          await (window as any).__updateSW(true);
        } catch (_) {}
      }

      // 3. Clear browser CacheStorage
      if ('caches' in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        } catch (_) {}
      }

      // 4. Update service worker registrations
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.update();
          }
        } catch (_) {}
      }

      // 5. Hard reload page with cache-busting param
      setTimeout(() => {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('_v', Date.now().toString());
        window.location.replace(currentUrl.toString());
      }, 400);
    } catch (e) {
      console.error('[UpdateSystem] Erro ao aplicar atualização:', e);
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('hbn1_update_dismissed_session', 'true');
    setIsMinimized(true);
  };

  if (!hasUpdate) return null;

  return (
    <AnimatePresence>
      {/* Minimized floating button if user dismissed the modal */}
      {isMinimized && (
        <motion.div
          initial={{ y: 50, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-[99999]"
        >
          <button
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-full shadow-2xl shadow-orange-950/40 border border-orange-400/50 text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all group"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
            <RefreshCw size={15} className="group-hover:rotate-180 transition-transform duration-500" />
            <span>Atualização Pronta</span>
          </button>
        </motion.div>
      )}

      {/* Full Attention Modal */}
      {!isMinimized && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-white rounded-[32px] w-full max-w-md p-6 sm:p-8 shadow-2xl border border-orange-500/40 relative overflow-hidden"
          >
            {/* Top decorative accent glow */}
            <div className="absolute -top-16 -left-16 w-44 h-44 bg-orange-500/25 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-44 h-44 bg-amber-500/25 rounded-full blur-3xl pointer-events-none" />

            {/* Close / Minimize button */}
            <button
              onClick={handleDismiss}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Lembrar mais tarde"
            >
              <X size={18} />
            </button>

            <div className="text-center space-y-4 relative z-10">
              {/* Icon */}
              <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white shadow-xl shadow-orange-500/30 ring-4 ring-orange-500/15">
                <Sparkles size={32} className="animate-pulse" />
              </div>

              {/* Status Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-600 dark:text-orange-400 text-xs font-black tracking-wider uppercase border border-orange-200 dark:border-orange-800/60">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                Nova Versão do Sistema {latestVersion ? `v${latestVersion}` : ''}
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                  Atualização Disponível!
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Novas modificações e melhorias foram publicadas pelo <span className="font-bold text-orange-600 dark:text-orange-400">Studio IA</span>.
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-400">
                  Clique no botão abaixo para carregar e aplicar as alterações instantaneamente, sem perder seus dados ou pedidos em andamento.
                </p>
              </div>

              {/* Benefits list */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/70 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-left space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Check size={14} className="text-green-500 shrink-0 font-bold" />
                  <span>Sincronização imediata de novos recursos</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Check size={14} className="text-green-500 shrink-0 font-bold" />
                  <span>Limpeza automática de cache e arquivos antigos</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Check size={14} className="text-green-500 shrink-0 font-bold" />
                  <span>Replicado para vendedores e links de clientes</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2.5">
                <button
                  disabled={isUpdating}
                  onClick={handleApplyUpdate}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-xl shadow-orange-600/30 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-75"
                >
                  <RefreshCw size={18} className={isUpdating ? "animate-spin" : ""} />
                  <span>{isUpdating ? "Aplicando Alterações..." : "Atualizar e Aplicar Agora"}</span>
                </button>

                <button
                  disabled={isUpdating}
                  onClick={handleDismiss}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Lembrar mais tarde
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
