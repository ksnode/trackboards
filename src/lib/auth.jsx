import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from './supabase';

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
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
      .single();
    
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        if (mounted) setUser(session.user);
        const profileData = await fetchProfile(session.user.id);
        if (mounted) {
          setProfile(profileData);
          if (profileData && profileData.is_active === false) {
            await supabase.auth.signOut();
            alert("Twoje konto zostało zablokowane"); // Should use Toast later
          }
        }
      }
      if (mounted) setLoading(false);
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        if (mounted) setUser(session.user);
        const profileData = await fetchProfile(session.user.id);
        if (mounted) {
          setProfile(profileData);
          if (profileData && profileData.is_active === false) {
            await supabase.auth.signOut();
            alert("Twoje konto zostało zablokowane"); // Should use Toast later
          }
        }
      } else {
        if (mounted) {
          setUser(null);
          setProfile(null);
        }
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
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
