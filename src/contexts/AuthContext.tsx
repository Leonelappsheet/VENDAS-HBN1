import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, Client } from '../types';
import { dataService } from '../services/dataService';
import { auth } from '../lib/firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';

interface AuthContextType {
  profile: UserProfile | null;
  loading: boolean;
  selectedClient: Client | null;
  setSelectedClient: (client: Client | null) => Promise<void>;
  login: (username: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClientState] = useState<Client | null>(() => {
    try {
      const saved = localStorage.getItem('selectedClient');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [userStateLoaded, setUserStateLoaded] = useState(false);
  const [firebaseAuthed, setFirebaseAuthed] = useState(false);

  // Listen for firebase auth state change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseAuthed(!!user);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to userState in Firestore when profile changes and firebase is authenticated
  useEffect(() => {
    if (loading) {
      // Wait until local storage profile loading is complete
      return;
    }

    if (!profile) {
      setSelectedClientState(null);
      setUserStateLoaded(true);
      return;
    }

    if (!firebaseAuthed) {
      // Do not block rendering, but mark as not loaded yet for Firestore
      return;
    }

    setUserStateLoaded(false);

    // Safety timeout: proceed after 1.5 seconds under any circumstance
    const timeoutId = setTimeout(() => {
      console.warn('User state subscription safety timeout triggered.');
      setUserStateLoaded(true);
    }, 1500);

    const unsubscribe = dataService.subscribeUserState(profile.uid, (client) => {
      clearTimeout(timeoutId);
      if (client) {
        setSelectedClientState(client);
      } else {
        // If Firestore has no saved client but we have one locally, use it and upload to Firestore
        try {
          const localSaved = localStorage.getItem('selectedClient');
          if (localSaved) {
            const parsed = JSON.parse(localSaved);
            if (parsed) {
              setSelectedClientState(parsed);
              dataService.saveUserState(profile.uid, parsed).catch(err => {
                console.error("Error pushing local userState to firestore:", err);
              });
              setUserStateLoaded(true);
              return;
            }
          }
        } catch (e) {
          console.warn("Failed to parse local selectedClient:", e);
        }
        setSelectedClientState(null);
      }
      setUserStateLoaded(true);
    });

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [profile, firebaseAuthed, loading]);

  // Synchronize selectedClient to localStorage
  useEffect(() => {
    if (loading) {
      // Do not touch localStorage during initial load to prevent premature wipes
      return;
    }
    try {
      if (selectedClient) {
        localStorage.setItem('selectedClient', JSON.stringify(selectedClient));
      } else {
        localStorage.removeItem('selectedClient');
      }
    } catch (e) {
      console.error('Failed to sync selectedClient to localStorage:', e);
    }
  }, [selectedClient, loading]);

  const setSelectedClient = async (client: Client | null) => {
    if (!profile) return;
    setSelectedClientState(client);
    try {
      if (client) {
        localStorage.setItem('selectedClient', JSON.stringify(client));
      } else {
        localStorage.removeItem('selectedClient');
      }
    } catch (e) {
      console.error('Failed to sync selectedClient to localStorage:', e);
    }
    try {
      await dataService.saveUserState(profile.uid, client);
    } catch (err) {
      console.error('Failed to save user state in Firestore:', err);
    }
  };

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
            
            if (parsed.role === 'cliente') {
              const savedClient = localStorage.getItem('selectedClient');
              if (savedClient) {
                try {
                  setSelectedClientState(JSON.parse(savedClient));
                } catch (e) {}
              }
            }

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
            
            // Auto-refresh profile in background (only for non-clients)
            if (parsed.role !== 'cliente') {
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
            }
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

      // Check Client login by CNPJ (e.g. 00.000.000/0001-00 or 00000000000100)
      const cleanInputDigits = username.replace(/\D/g, '');
      const rawUsername = username.trim().toLowerCase();
      const inputPassword = (password || '').trim();

      const clients = await dataService.getClients(undefined, true);
      const foundClient = clients.find(c => {
        if (!c) return false;
        const cCnpjClean = (c.cnpj || '').replace(/\D/g, '');
        if (cleanInputDigits.length >= 6 && cCnpjClean === cleanInputDigits) {
          return true;
        }
        if (c.cnpj && c.cnpj.trim().toLowerCase() === rawUsername) {
          return true;
        }
        if (c.id && String(c.id).trim().toLowerCase() === rawUsername) {
          return true;
        }
        return false;
      });

      if (foundClient) {
        const cleanClientCnpj = (foundClient.cnpj || '').replace(/\D/g, '');
        // Default password: first 6 digits of clean CNPJ (or clean client ID if CNPJ unavailable)
        const expectedPassword = cleanClientCnpj.substring(0, 6) || String(foundClient.id).substring(0, 6);

        if (inputPassword === expectedPassword) {
          if (!auth.currentUser) {
            try {
              await signInAnonymously(auth);
            } catch (authError) {
              console.warn('Anonymous auth failed during client login:', authError);
            }
          }

          const clientProfile: UserProfile = {
            uid: `client_${foundClient.id}`,
            name: foundClient.tradeName || foundClient.name,
            role: 'cliente',
            phone: foundClient.phone || '',
            email: foundClient.email || '',
            regional: foundClient.regional || 'TIMON-MA'
          };

          setProfile(clientProfile);
          setSelectedClientState(foundClient);

          localStorage.setItem('VENDAS_profile', JSON.stringify(clientProfile));
          localStorage.setItem('selectedClient', JSON.stringify(foundClient));

          try {
            await dataService.saveUserState(clientProfile.uid, foundClient);
          } catch (e) {
            console.warn('Failed to save client user state:', e);
          }

          return true;
        }
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

  const isAuthLoading = loading;

  return (
    <AuthContext.Provider value={{ profile, loading: isAuthLoading, selectedClient, setSelectedClient, login, logout }}>
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
