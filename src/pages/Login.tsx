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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#FF6B00] to-[#F06292] p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
      >
        <div className="text-center mb-8">
          <motion.img 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            src="/logo.svg" 
            alt="Logo" 
            className="w-20 h-20 mx-auto mb-4"
          />
          <h1 className="font-display text-4xl font-extrabold bg-gradient-to-r from-[#FF6B00] to-[#F06292] bg-clip-text text-transparent leading-tight">
            VENDAS HBN1
          </h1>
          <p className="text-gray-500 text-sm mt-2 font-medium">
            Higiene & Beleza — Acesso do Vendedor
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Usuário</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Digite seu usuário"
              className="w-full bg-orange-50/50 border-2 border-transparent focus:border-orange-200 rounded-2xl px-4 py-3 outline-none transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              className="w-full bg-orange-50/50 border-2 border-transparent focus:border-orange-200 rounded-2xl px-4 py-3 outline-none transition-all font-medium"
            />
          </div>

          {error && (
            <p className="text-red-500 text-xs font-bold text-center mt-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoggingIn || loading}
            className="w-full bg-gradient-to-r from-[#FF6B00] to-[#F06292] text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-6"
          >
            {isLoggingIn ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-gray-400">
          <p>© 2025 VENDAS HBN1</p>
          <p>TIMON-MA | (86) 99964-7573</p>
        </div>
      </motion.div>
    </div>
  );
}
