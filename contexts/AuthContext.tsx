import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile, AppRole } from '@/types/database';
import { registerPushToken, unregisterPushToken } from '@/lib/notificationService';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  userRole: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, nomComplet: string, contact: string, role: AppRole) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let authStateChangeFired = false;

    const hardTimeout = setTimeout(() => {
      setLoading(false);
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authStateChangeFired = true;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setUserRole(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (authStateChangeFired) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id).finally(() => clearTimeout(hardTimeout));
      } else {
        setTimeout(() => {
          if (!authStateChangeFired) {
            clearTimeout(hardTimeout);
            setLoading(false);
          }
        }, 500);
      }
    }).catch(() => {
      clearTimeout(hardTimeout);
      setLoading(false);
    });

    return () => {
      clearTimeout(hardTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (roleError) throw roleError;
      setUserRole(roleData.role);
      registerPushToken(userId).catch(() => {});
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (
    email: string,
    password: string,
    nomComplet: string,
    contact: string,
    role: AppRole
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nom_complet: nomComplet,
          contact: contact,
        },
      },
    });

    if (error) return { error };

    if (data.user) {
      const { error: roleError } = await supabase.rpc('assign_self_role', {
        role_name: role,
      });

      if (roleError) {
        console.error('Error assigning role:', roleError);
      }

      if (role === 'vendeur') {
        const slug = nomComplet
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
          + '-' + Date.now().toString(36);
        await supabase.from('shops').insert({
          owner_id: data.user.id,
          name: nomComplet,
          slug,
          is_active: false,
          verification_status: 'pending',
        }).then(() => {});
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    if (user) {
      await unregisterPushToken(user.id).catch(() => {});
    }
    setSession(null);
    setUser(null);
    setProfile(null);
    setUserRole(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        userRole,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
