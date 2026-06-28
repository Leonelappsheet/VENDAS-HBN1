import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app is already installed or running in standalone mode
    const checkStandalone = () => {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone ||
        document.referrer.includes('android-app://')
      );
    };

    setIsStandalone(checkStandalone());

    const handler = (e: any) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      
      // Delay showing the prompt a bit for better UX after login
      const timer = setTimeout(() => {
        if (!checkStandalone() && !localStorage.getItem('pwa-prompt-dismissed')) {
          setIsVisible(true);
        }
      }, 3000);

      return () => clearTimeout(timer);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setIsVisible(false);
    } else {
      console.log('User dismissed the install prompt');
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Remember dismissal for 7 days
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  if (isStandalone || !isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-4 left-4 right-4 z-[9999] md:left-auto md:right-8 md:bottom-8 md:max-w-sm"
      >
        <div className="bg-[#1A1A1A] text-white p-4 rounded-3xl shadow-2xl border border-white/10 flex items-center gap-4">
          <div className="w-12 h-12 bg-[#FF8C00] rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
            <img src="/logo.svg" alt="App Icon" className="w-8 h-8 brightness-0 invert" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm leading-tight">Instale nosso app</h3>
            <p className="text-white/60 text-xs mt-0.5 line-clamp-2">
              Acesso rápido direto da tela inicial. Grátis e sem ocupar espaço.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleDismiss}
              className="p-2 text-white/40 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
            <button
              onClick={handleInstall}
              className="bg-[#FF8C00] hover:bg-[#FF7B00] text-white px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 whitespace-nowrap shadow-lg shadow-orange-900/20 active:scale-95 transition-all"
            >
              <Download size={14} />
              Instalar
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
