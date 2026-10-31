import React from 'react';

export class ErrorBoundary extends React.Component<
  { children?: React.ReactNode },
  { hasError: boolean; errorMessage?: string }
> {
  declare props: { children?: React.ReactNode };
  declare state: { hasError: boolean; errorMessage?: string };

  constructor(props: { children?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { 
      hasError: true, 
      errorMessage: error?.message || 'Ocorreu um erro inesperado na interface.' 
    };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleClearCacheAndReload = () => {
    try {
      sessionStorage.clear();
      // Clear non-critical caches while preserving the user's login session
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !key.startsWith('VENDAS_profile')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.warn('Failed clearing cache:', e);
    }
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-[#FDF6F0] text-gray-800">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 mb-2">Ops! Algo inesperado aconteceu.</h1>
          <p className="text-xs sm:text-sm text-gray-600 max-w-md mb-6">
            O aplicativo encontrou uma instabilidade temporária. Você pode tentar recarregar ou limpar os dados temporários em cache.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              className="px-5 py-2.5 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors shadow-md text-sm cursor-pointer"
              onClick={() => window.location.reload()}
            >
              Recarregar Página
            </button>
            <button
              className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors shadow-sm text-sm cursor-pointer"
              onClick={this.handleClearCacheAndReload}
            >
              Limpar Cache e Reiniciar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
