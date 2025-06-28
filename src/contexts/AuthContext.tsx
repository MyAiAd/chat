import { createContext, useEffect, useState, ReactNode } from 'react';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { toast } from 'react-toastify';

// Define types for our context
type AuthContextType = {
  supabase: SupabaseClient;
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{
    error: unknown;
    data: unknown;
  }>;
  signUp: (email: string, password: string, name: string) => Promise<{
    error: unknown;
    data: unknown;
  }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{
    error: unknown;
    data: unknown;
  }>;
};

// Default context value will be created after environment variables are loaded

// Validate environment variables FIRST
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// DEBUG: Log environment variables to help diagnose production issues
console.log('🔍 Environment Variables Debug:');
console.log('- VITE_SUPABASE_URL:', supabaseUrl);
console.log('- VITE_SUPABASE_ANON_KEY:', supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'undefined');
console.log('- NODE_ENV:', import.meta.env.NODE_ENV);
console.log('- MODE:', import.meta.env.MODE);

// Check if we have valid environment variables
const hasValidConfig = Boolean(supabaseUrl && supabaseKey);

if (!supabaseUrl) {
  console.warn('Missing environment variable: VITE_SUPABASE_URL');
  console.warn('Available env vars:', Object.keys(import.meta.env));
}

if (!supabaseKey) {
  console.warn('Missing environment variable: VITE_SUPABASE_ANON_KEY');
}

// Only validate URL format if supabaseUrl exists
if (supabaseUrl) {
  try {
    new URL(supabaseUrl);
    console.log('✅ Valid Supabase URL format');
  } catch {
    console.warn(`Invalid VITE_SUPABASE_URL: ${supabaseUrl}`);
  }
}

// IMPORTANT: Fail fast if no valid config instead of using placeholders
if (!hasValidConfig) {
  console.error('❌ CRITICAL: Missing Supabase environment variables!');
  console.error('This will cause connection failures. Check your deployment configuration.');
}

// Set up the Supabase client with fallback values to prevent crashes
const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  }
);

// FIXED: Create default context value with the ACTUAL supabase client, not placeholder
const defaultContextValue: AuthContextType = {
  supabase: supabase, // Use the real client, not placeholder
  user: null,
  isAdmin: false,
  loading: true,
  signIn: async () => ({ 
    data: null, 
    error: { message: 'AuthProvider not mounted' } 
  }),
  signUp: async () => ({ 
    data: null, 
    error: { message: 'AuthProvider not mounted' } 
  }),
  signOut: async () => {
    console.error('AuthProvider not mounted');
  },
  resetPassword: async () => ({ 
    data: null, 
    error: { message: 'AuthProvider not mounted' } 
  })
};

export const AuthContext = createContext<AuthContextType>(defaultContextValue);

// Create the provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Helper function to check if user is admin
  const checkAdminStatus = (user: User | null): boolean => {
    if (!user) return false;
    const adminFlag = user.user_metadata?.is_admin;
    return adminFlag === true || adminFlag === 'true';
  };

  console.log('AuthProvider: Initializing with loading =', loading, 'user =', user?.email || 'null', 'hasValidConfig =', hasValidConfig);

  // DISABLED: Create user profile function to prevent circular dependencies
  // This was causing infinite loops with RLS policies
  // const createUserProfile = async (_userId: string, _email: string, _name?: string) => {
  //   console.log('createUserProfile: DISABLED to prevent circular dependencies');
  //   // Skip all user profile creation to avoid RLS circular dependencies
  //   return;
  // };

  // Function to force clean start - KEPT for emergency use but not used in normal flow
  // const forceCleanStart = async () => {
  //   try {
  //     console.log('AuthProvider: Forcing clean start - clearing all auth data...');
  //     
  //     // Step 1: Clear user state immediately
  //     setUser(null);
  //     
  //     // Step 2: Clear ALL Supabase-related storage
  //     try {
  //       // Clear all localStorage keys that start with 'sb-'
  //       const keysToRemove = [];
  //       for (let i = 0; i < localStorage.length; i++) {
  //         const key = localStorage.key(i);
  //         if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
  //           keysToRemove.push(key);
  //         }
  //       }
  //       
  //       keysToRemove.forEach(key => {
  //         console.log(`AuthProvider: Removing localStorage key: ${key}`);
  //         localStorage.removeItem(key);
  //       });
  //       
  //       // Clear sessionStorage completely
  //       sessionStorage.clear();
  //       console.log('AuthProvider: All storage cleared');
  //     } catch (e) {
  //       console.warn('Could not clear storage:', e);
  //     }
  //     
  //     // Step 3: Call Supabase signOut if we have valid config
  //     if (hasValidConfig) {
  //       console.log('AuthProvider: Calling supabase.auth.signOut() for clean start...');
  //       try {
  //         const { error } = await supabase.auth.signOut({ scope: 'global' });
  //         if (error) {
  //           console.warn('AuthProvider: SignOut error during clean start:', error);
  //         } else {
  //           console.log('AuthProvider: Clean signOut successful');
  //         }
  //       } catch (error) {
  //         console.warn('AuthProvider: Exception during signOut:', error);
  //       }
  //     }
  //     
  //     console.log('AuthProvider: Clean start completed - user should be null');
  //     return true;
  //   } catch (error) {
  //     console.error('AuthProvider: Error during clean start:', error);
  //     return false;
  //   }
  // };

  // Function to clear stale session data - DISABLED to prevent loops
  // const clearStaleSession = async () => {
  //   console.log('clearStaleSession: DISABLED to prevent infinite loops');
  //   // Always return false to force logged-out state
  //   return false;
  // };

  useEffect(() => {
    let mounted = true;

    // Longer timeout to ensure proper session restoration
    const loadingTimeout = setTimeout(() => {
      console.log('AuthProvider: Loading timeout reached, forcing loading to false');
      if (mounted) {
        setLoading(false);
      }
    }, 5000); // Increased to 5 seconds to allow proper session restoration

    // SIMPLIFIED BUT FUNCTIONAL: Initialize auth state
    const initAuth = async () => {
      console.log('AuthProvider: Starting SIMPLIFIED but FUNCTIONAL initAuth...');
      try {
        // If no valid config, immediately set loading to false
        if (!hasValidConfig) {
          console.warn('Supabase environment variables not configured properly');
          console.log('AuthProvider: Setting loading to false due to missing env vars');
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          clearTimeout(loadingTimeout);
          return;
        }

        console.log('AuthProvider: Checking for existing session...');
        
        // Check for existing session with longer timeout to prevent race conditions
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session timeout')), 5000)
        );
        
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as { data: { session: Session | null } };
        console.log('AuthProvider: Session result:', session ? 'found' : 'not found');
        
        if (session?.user && mounted) {
          console.log('AuthProvider: Setting user from existing session:', session.user.email);
          setUser(session.user);
          setIsAdmin(checkAdminStatus(session.user));
          console.log('AuthProvider: Admin status:', checkAdminStatus(session.user));
          // NOTE: createUserProfile is still disabled to prevent RLS loops
        } else {
          console.log('AuthProvider: No existing session, user remains null');
          setUser(null);
          setIsAdmin(false);
        }
        
        // Ensure loading is set to false after session check completes
        console.log('AuthProvider: Session check complete, setting loading to false');
        if (mounted) {
          setLoading(false);
        }
        clearTimeout(loadingTimeout);
        
      } catch (error) {
        console.error('Auth initialization error:', error);
        // On error, ensure clean state
        if (mounted) {
          setUser(null);
          setIsAdmin(false);
          setLoading(false);
        }
        clearTimeout(loadingTimeout);
      }
    };

    initAuth();

    // RESTORED: Simplified auth state change listener for login retention
    let subscription: { unsubscribe: () => void } | null = null;
    
    if (hasValidConfig) {
      try {
        console.log('AuthProvider: Setting up SIMPLIFIED auth state change listener...');
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('AuthProvider: Auth state change:', event, session ? 'session exists' : 'no session');
          if (mounted) {
            try {
              if (session?.user) {
                console.log('AuthProvider: Setting user from auth state change:', session.user.email);
                setUser(session.user);
                setIsAdmin(checkAdminStatus(session.user));
                console.log('AuthProvider: Admin status from auth change:', checkAdminStatus(session.user));
                // NOTE: createUserProfile is still disabled to prevent RLS loops
              } else {
                console.log('AuthProvider: Clearing user from auth state change');
                setUser(null);
                setIsAdmin(false);
              }
            } catch (error) {
              console.error('Auth state change error:', error);
              // Don't let errors break the auth flow
            } finally {
              setLoading(false);
            }
          }
        });
        subscription = authSubscription;
        console.log('AuthProvider: Auth state change listener set up successfully');
      } catch (error) {
        console.error('Error setting up auth state listener:', error);
      }
    }

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      if (!hasValidConfig) {
        return { 
          data: null, 
          error: { message: 'Supabase not configured. Please set up environment variables.' }
        };
      }
      
      console.log('AuthContext: Attempting sign in for:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (data?.user && !error) {
        console.log('AuthContext: Sign in successful, user:', data.user.email);
        // The auth state change listener will handle setting the user
      }
      
      return { data, error };
    } catch (error) {
      console.error('Sign in error:', error);
      return { data: null, error };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      if (!hasValidConfig) {
        return { 
          data: null, 
          error: { message: 'Supabase not configured. Please set up environment variables.' }
        };
      }
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });
      return { data, error };
    } catch (error) {
      console.error('Sign up error:', error);
      return { data: null, error };
    }
  };

  const signOut = async () => {
    console.log('AuthContext: signOut called - START');
    console.log('AuthContext: hasValidConfig =', hasValidConfig);
    console.log('AuthContext: current user =', user?.email || 'null');
    
    try {
      // Step 1: Clear user state immediately
      console.log('AuthContext: Clearing user state...');
      setUser(null);
      setIsAdmin(false);
      
      // Step 2: Clear ALL Supabase-related storage
      console.log('AuthContext: Clearing all Supabase storage...');
      try {
        // Clear all localStorage keys that start with 'sb-'
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
            keysToRemove.push(key);
          }
        }
        
        keysToRemove.forEach(key => {
          console.log(`AuthContext: Removing localStorage key: ${key}`);
          localStorage.removeItem(key);
        });
        
        // Clear sessionStorage completely
        sessionStorage.clear();
        console.log('AuthContext: All storage cleared');
      } catch (e) {
        console.warn('Could not clear storage:', e);
      }
      
      // Step 3: Call Supabase signOut if we have valid config
      if (hasValidConfig) {
        console.log('AuthContext: Calling supabase.auth.signOut()...');
        const { error } = await supabase.auth.signOut({ scope: 'global' });
        if (error) {
          console.error('AuthContext: Supabase signOut error:', error);
          // Don't throw the error, just log it and continue
        } else {
          console.log('AuthContext: Supabase signOut successful');
        }
      } else {
        console.log('AuthContext: No valid config, skipping Supabase logout');
      }
      
      // Step 4: Show success message
      toast.success('Successfully logged out!');
      
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if there's an error, ensure user state is cleared
      setUser(null);
      setIsAdmin(false);
    }
    
    // Step 5: Force redirect to login page
    console.log('AuthContext: Forcing redirect to login page');
    
    // Use replace to prevent back button issues
    window.location.replace('/login');
    
    console.log('AuthContext: signOut called - END');
  };

  const resetPassword = async (email: string) => {
    if (!hasValidConfig) {
      return { 
        data: null, 
        error: { message: 'Supabase not configured. Please set up environment variables.' }
      };
    }
    
    return await supabase.auth.resetPasswordForEmail(email);
  };

  return (
    <AuthContext.Provider
      value={{
        supabase,
        user,
        isAdmin,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};