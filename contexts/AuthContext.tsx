import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile, AppRole } from '@/types/database';
import { registerPushToken, unregisterPushToken } from '@/lib/notificationService';

export interface BlockedAccountInfo {
  reason: string | null;
  supportPhone: string;
  supportEmail: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  userRole: AppRole | null;
  loading: boolean;
  blockedAccount: BlockedAccountInfo | null;
  clearBlockedAccount: () => void;
  setSessionFromTokens: (accessToken: string, refreshToken: string) => Promise<void>;
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
  const [blockedAccount, setBlockedAccount] = useState<BlockedAccountInfo | null>(null);

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

      if (profileData?.is_blocked) {
        let supportPhone = '+22300000000';
        let supportEmail = 'support@fere.app';
        try {
          const { data: settings } = await supabase
            .from('platform_settings')
            .select('support_email, support_phone')
            .maybeSingle();
          if (settings?.support_phone) supportPhone = settings.support_phone;
          if (settings?.support_email) supportEmail = settings.support_email;
        } catch {
          // use defaults
        }

        setBlockedAccount({
          reason: profileData.blocked_reason ?? null,
          supportPhone,
          supportEmail,
        });

        setProfile(null);
        setUser(null);
        setSession(null);
        setUserRole(null);
        await supabase.auth.signOut();
        return;
      }

      setProfile(profileData);

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      const fetchedRole = rolesData?.[0]?.role ?? null;
      setUserRole(fetchedRole);
      registerPushToken(userId).catch(() => {});
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearBlockedAccount = () => {
    setBlockedAccount(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  const setSessionFromTokens = async (accessToken: string, refreshToken: string) => {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      console.error('[Auth] setSession failed:', error.message);
      throw error;
    }
    // Wait for SecureStore to flush on Android before verifying
    await new Promise((resolve) => setTimeout(resolve, 300));
    const { data: verify } = await supabase.auth.getSession();
    console.log('[Auth] setSession confirmed:', {
      persisted: !!verify?.session,
      userId: verify?.session?.user?.id,
      tokenLength: verify?.session?.access_token?.length,
    });
    if (!verify?.session?.access_token) {
      throw new Error('Session non persistee. Reconnectez-vous.');
    }
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
        blockedAccount,
        clearBlockedAccount,
        setSessionFromTokens,
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

export const useAuthSafe = (): AuthContextType | null => {
  const context = useContext(AuthContext);
  return context ?? null;
};
