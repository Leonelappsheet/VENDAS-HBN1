import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const { profile, login, loading } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (profile) return <Navigate to="/" />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Preencha todos os campos');
      return;
    }

    try {
      setIsLoggingIn(true);
      setError('');
      const success = await login(username, password);
      if (!success) {
        setError('Usuário ou senha incorretos');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-brand-blue p-6 relative overflow-hidden">
      {/* Decorative background stars or shapes */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 rounded-full bg-brand-orange/10 blur-3xl" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 rounded-full bg-brand-blue-light/30 blur-3xl" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative z-10 border border-slate-100"
      >
        <div className="text-center mb-8">
          {/* Nazaria-styled Star Emblem */}
          <div className="w-16 h-16 bg-brand-orange text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-orange/20">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9">
              <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.21l8.2-1.192L12 .587z" />
            </svg>
          </div>
          
          <h1 className="font-display text-3xl font-extrabold text-brand-blue tracking-tight leading-tight uppercase">
            VENDAS NAZÁRIA
          </h1>
          <p className="text-slate-500 text-xs mt-1.5 font-medium tracking-wide uppercase">
            Distribuidora Farmacêutica — Portal do Vendedor
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 ml-1 uppercase tracking-wider">Usuário</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Digite seu usuário"
              className="w-full bg-slate-50 border border-slate-200 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/10 rounded-2xl px-4 py-3 outline-none transition-all font-medium text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 ml-1 uppercase tracking-wider">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              className="w-full bg-slate-50 border border-slate-200 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/10 rounded-2xl px-4 py-3 outline-none transition-all font-medium text-slate-900"
            />
          </div>

          {error && (
            <p className="text-red-600 text-xs font-bold text-center mt-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoggingIn || loading}
            className="w-full bg-brand-orange hover:bg-brand-orange-light text-white py-4 rounded-2xl font-bold text-base shadow-lg shadow-brand-orange/10 hover:shadow-brand-orange/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-6 cursor-pointer"
          >
            {isLoggingIn ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-[10px] text-slate-400 font-mono">
          <p>© 2026 NAZÁRIA DISTRIBUIDORA</p>
          <p>TIMON-MA | (86) 99964-7573</p>
        </div>
      </motion.div>
    </div>
  );
}
