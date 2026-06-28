import React, { useState, useEffect } from 'react';
import { AlertTriangle, ExternalLink, Copy, Check, Save, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface StatusData {
  ok: boolean;
  serviceAccountEmail: string;
  spreadsheetId: string;
  isApiKey: boolean;
  spreadsheetInfo: any;
  spreadsheetError: string;
  instructions: string[];
}

export function ConfigWarning() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [copied, setCopied] = useState(false);
  const [customId, setCustomId] = useState('');
  const [currentReg, setCurrentReg] = useState('TIMON-MA');

  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => setStatus(data))
      .catch(err => console.error('Error fetching status:', err));

    try {
      const savedProfile = localStorage.getItem('VENDAS_profile');
      let regional = 'TIMON-MA';
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        if (parsed.regional) {
          regional = parsed.regional;
          setCurrentReg(parsed.regional);
        }
      }
      const savedId = localStorage.getItem(`CUSTOM_SPREADSHEET_ID_${regional}`);
      if (savedId) {
        setCustomId(savedId);
      }
    } catch (e) {}
  }, []);

  const copyEmail = () => {
    if (status?.serviceAccountEmail) {
      navigator.clipboard.writeText(status.serviceAccountEmail);
      setCopied(true);
      toast.success('E-mail copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveCustomId = (e: React.FormEvent) => {
    e.preventDefault();
    let cleaned = customId.trim();
    // Extract ID if a full URL is pasted
    const match = cleaned.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      cleaned = match[1];
    }

    try {
      if (cleaned) {
        localStorage.setItem(`CUSTOM_SPREADSHEET_ID_${currentReg}`, cleaned);
        toast.success('ID da Planilha personalizado salvo com sucesso!');
      } else {
        localStorage.removeItem(`CUSTOM_SPREADSHEET_ID_${currentReg}`);
        toast.success('Restaurado para a planilha padrão!');
      }
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar ID personalizado.');
    }
  };

  const handleReset = () => {
    try {
      localStorage.removeItem(`CUSTOM_SPREADSHEET_ID_${currentReg}`);
      setCustomId('');
      toast.success('Restaurado para a planilha padrão!');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error(err);
    }
  };

  if (!status || status.ok) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-6 shadow-xl"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center text-red-600 shrink-0">
          <AlertTriangle size={28} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-red-900 dark:text-red-100 mb-2">
            Erro de Configuração Detectado
          </h3>
          <p className="text-red-700 dark:text-red-300 text-sm mb-4 leading-relaxed">
            {status.spreadsheetError}
          </p>

          {status.isApiKey && (
            <div className="bg-white/50 dark:bg-black/20 p-4 rounded-xl border border-red-200 dark:border-red-800 mb-4">
              <p className="text-red-800 dark:text-red-200 font-bold text-sm mb-2 uppercase tracking-wider">
                ⚠️ AÇÃO NECESSÁRIA:
              </p>
              <p className="text-red-700 dark:text-red-300 text-sm">
                Você colou uma <strong>Chave de API</strong> no lugar do <strong>ID da Planilha</strong>. 
                Vá nas configurações do AI Studio (Secrets) ou no painel da Netlify (Environment Variables) e troque o valor de <code>GOOGLE_SHEET_ID</code> pelo ID que aparece na URL da sua planilha.
              </p>
            </div>
          )}

          {/* Custom Spreadsheet ID Override Section */}
          <div className="bg-white dark:bg-gray-800/60 p-5 rounded-2xl border border-red-200 dark:border-red-800/60 mb-5 shadow-sm">
            <h4 className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
              🔌 Conectar sua própria planilha ({currentReg})
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              Insira o link ou o ID da planilha do Google Sheets que você criou para esta regional:
            </p>
            <form onSubmit={handleSaveCustomId} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="ID ou Link da Planilha"
                value={customId}
                onChange={e => setCustomId(e.target.value)}
                className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-400 dark:text-white"
              />
              <div className="flex gap-2 shrink-0">
                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1 transition-colors"
                >
                  <Save size={14} /> Salvar
                </button>
                {localStorage.getItem(`CUSTOM_SPREADSHEET_ID_${currentReg}`) && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw size={14} /> Resetar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-red-800 dark:text-red-200 uppercase">Instruções:</p>
            <ul className="space-y-2">
              {status.instructions.map((inst, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                  <span className="w-5 h-5 bg-red-200 dark:bg-red-800 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">
                    {i + 1}
                  </span>
                  {inst}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button 
              onClick={copyEmail}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-red-600/20"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'E-mail Copiado!' : 'Copiar E-mail do Robô'}
            </button>
            <a 
              href={`https://docs.google.com/spreadsheets/d/${status.spreadsheetId}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors"
            >
              <ExternalLink size={16} />
              Abrir Planilha
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
