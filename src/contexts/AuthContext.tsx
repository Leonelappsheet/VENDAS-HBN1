import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { dataService } from '../services/dataService';
import { auth } from '../lib/firebase';
import { signInAnonymously } from 'firebase/auth';

interface AuthContextType {
  profile: UserProfile | null;
  loading: boolean;
  login: (username: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        let savedProfile = null;
        try {
          savedProfile = localStorage.getItem('VENDAS_profile');
        } catch (storageError) {
          console.warn('LocalStorage access failed:', storageError);
        }

        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile);
            setProfile(parsed);
            
            // Sign in to Firebase Auth anonymously to satisfy firestore rules
            if (!auth.currentUser) {
              try {
                // Use a timeout for anonymous auth so it doesn't block forever
                const authPromise = signInAnonymously(auth);
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Auth Timeout')), 5000)
                );
                await Promise.race([authPromise, timeoutPromise]);
              } catch (authError) {
                console.warn('Anonymous auth failed or timed out:', authError);
              }
            }
            
            // Auto-refresh profile in background
            dataService.getUsersFromSheets().then(users => {
              const foundUser = users.find(u => u.username.toLowerCase() === parsed.uid.toLowerCase());
              if (foundUser) {
                const updatedProfile = { 
                  ...parsed, 
                  phone: foundUser.phone || parsed.phone, 
                  regional: foundUser.regional || parsed.regional,
                  role: (foundUser.role === 'admin' ? 'admin' : foundUser.role === 'promotor' ? 'promotor' : 'vendedor')
                };
                setProfile(updatedProfile);
                try {
                  localStorage.setItem('VENDAS_profile', JSON.stringify(updatedProfile));
                } catch (e) {}
              }
            }).catch(() => {});
          } catch (e) {
            console.error('Profile parse error:', e);
            try {
              localStorage.removeItem('VENDAS_profile');
            } catch (remError) {}
          }
        }
      } catch (fatalError) {
        console.error('Fatal initialization error:', fatalError);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password?: string) => {
    try {
      const users = await dataService.getUsersFromSheets();
      
      const foundUser = users.find(u => 
        u.username.toLowerCase() === username.toLowerCase() && 
        u.password === (password || '')
      );

      if (foundUser) {
        // Sign in to Firebase Auth
        if (!auth.currentUser) {
          try {
            await signInAnonymously(auth);
          } catch (authError) {
            console.warn('Anonymous auth failed during login:', authError);
          }
        }

        const newProfile: UserProfile = {
          uid: foundUser.username,
          name: foundUser.name || foundUser.username,
          role: (foundUser.role === 'admin' ? 'admin' : foundUser.role === 'promotor' ? 'promotor' : 'vendedor') as 'admin' | 'vendedor' | 'promotor',
          phone: foundUser.phone || '',
          email: foundUser.username,
          regional: foundUser.regional || 'TIMON-MA'
        };
        setProfile(newProfile);
        localStorage.setItem('VENDAS_profile', JSON.stringify(newProfile));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = async () => {
    setProfile(null);
    localStorage.removeItem('VENDAS_profile');
    await auth.signOut();
  };

  useEffect(() => {
    if (profile?.regional) {
      dataService.setRegional(profile.regional);
    }
  }, [profile]);

  return (
    <AuthContext.Provider value={{ profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
