import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from './supabase';

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  signInWithGoogle: async () => { },
  signOut: async () => { },
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  };

  useEffect(() => {
    let mounted = true;
    let resolved = false;

    // Auto-recovery: if auth doesn't resolve within 5s, force-clear.
    const recoveryTimer = setTimeout(async () => {
      if (resolved || !mounted) return;
      console.warn('[auth] Init timeout — clearing stuck session');
      try { await supabase.auth.signOut(); } catch {}
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-'))
        .forEach(k => localStorage.removeItem(k));
      if (mounted) {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    }, 5000);

    // onAuthStateChange callback runs INSIDE Supabase's Web Lock.
    // supabase.from() internally calls getSession() which needs the SAME lock.
    // → Deadlock if we do async Supabase calls inside the callback.
    //
    // Fix: callback returns synchronously (releases lock), then we
    // defer async work to setTimeout(0) which runs OUTSIDE the lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(async () => {
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          const profileData = await fetchProfile(session.user.id);
          if (!mounted) return;
          setProfile(profileData);
          if (profileData && profileData.is_active === false) {
            await supabase.auth.signOut();
            alert("Twoje konto zostało zablokowane");
          }
        } else {
          setUser(null);
          setProfile(null);
        }
        resolved = true;
        clearTimeout(recoveryTimer);
        setLoading(false);
      }, 0);
    });

    return () => {
      mounted = false;
      clearTimeout(recoveryTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      }
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export const RequireAuth = ({ children }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div>Ładowanie...</div>;

  if (!user || (profile && !profile.is_active)) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
};

export const RequireAdmin = ({ children }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div>Ładowanie...</div>;

  if (!user || !profile || profile.role !== 'admin' || !profile.is_active) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
};
