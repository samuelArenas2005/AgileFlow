import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  username: string | null;
  loading: boolean;
  login: (username: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (username: string, password?: string) => {
    // Formateamos como correo ya que Firebase requiere un correo electrónico
    const email = `${username}@agile-estimates.app`;
    // Usamos el pass indicado por el usuario, o uno default si viene vacío. Obligamos al menos a 6 chars.
    const finalPassword = password ? (password.length >= 6 ? password : password + '123456') : `${username}123456!`; 
    
    try {
      await signInWithEmailAndPassword(auth, email, finalPassword);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.message.includes('auth/invalid-credential')) {
        // If user doesn't exist, create one
        const res = await createUserWithEmailAndPassword(auth, email, finalPassword);
        await updateProfile(res.user, { displayName: username });
        setUser(auth.currentUser);
      } else {
        throw error;
      }
    }
  };

  const logout = async () => {
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, username: user?.displayName || null, loading, login, logout }}>
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
