import React, { useEffect, useRef, useState } from 'react';
import { Result } from '@zxing/library';
import { BrowserMultiFormatReader, BrowserCodeReader } from '@zxing/browser';
import { X, Camera, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BarcodeScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReader = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<any>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    codeReader.current = new BrowserMultiFormatReader();

    const startScanner = async () => {
      try {
        const videoInputDevices = await BrowserCodeReader.listVideoInputDevices();
        if (videoInputDevices.length === 0) {
          setError("Nenhum dispositivo de vídeo encontrado.");
          return;
        }

        // Try to find back camera
        const backCamera = videoInputDevices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('traseira')
        );
        const deviceId = backCamera ? backCamera.deviceId : videoInputDevices[0].deviceId;

        const controls = await codeReader.current!.decodeFromVideoDevice(deviceId, videoRef.current!, (result: Result | null, err?: any) => {
          if (result) {
            onScan(result.getText());
          }
          if (err) {
            const message = err.message || (typeof err === 'string' ? err : '');
            const isNotFound = err.name === 'NotFoundException' || 
                             message.includes('No MultiFormat Readers') ||
                             message.includes('No code detected') ||
                             message.includes('source width is 0') ||
                             message.includes('Track is in an invalid state');
            
            if (!isNotFound) {
              console.error('Scanner error:', err);
            }
          }
        });
        
        controlsRef.current = controls;
        setHasPermission(true);
      } catch (err) {
        console.error('Permission error:', err);
        setHasPermission(false);
        setError("Erro ao acessar a câmera. Verifique as permissões.");
      }
    };

    startScanner();

    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="relative w-full max-w-lg aspect-[3/4] bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10"
      >
        <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2 text-white">
            <Camera className="text-orange-500" size={24} />
            <span className="font-bold tracking-tight">LEITOR DE C\u00D3DIGO</span>
          </div>
          <button 
            onClick={onClose}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-colors backdrop-blur-md"
          >
            <X size={24} />
          </button>
        </div>

        {error ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-4">
            <div className="p-4 bg-red-500/20 rounded-full text-red-500">
              <Camera size={48} />
            </div>
            <p className="text-white font-medium">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-all font-bold flex items-center gap-2"
            >
              <RefreshCw size={20} /> REPETIR
            </button>
          </div>
        ) : (
          <div className="relative h-full">
            <video 
              ref={videoRef} 
              className="h-full w-full object-cover"
            />
            
            {/* Scanner UI Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-48 border-2 border-white/50 rounded-2xl relative">
                {/* Corners */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-orange-500 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-orange-500 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-orange-500 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-orange-500 rounded-br-lg" />
                
                {/* Laser Line */}
                <motion.div 
                  animate={{ top: ['10%', '90%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute left-4 right-4 h-0.5 bg-orange-500 shadow-[0_0_15px_rgba(255,107,0,0.8)]"
                />
              </div>
            </div>
            
            <div className="absolute bottom-12 inset-x-0 text-center">
              <p className="text-white/70 text-sm font-medium px-8 drop-shadow-lg">
                Posicione o c\u00F3digo de barras no centro do quadro
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
