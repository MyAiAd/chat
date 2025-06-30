import { createContext, useEffect, useState, ReactNode } from 'react';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { toast } from 'react-toastify';

// Define types for organizations and user roles
export interface Organization {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  settings: any;
  created_at: string;
  updated_at: string;
}

export interface UserOrganization {
  id: string;
  user_id: string;
  organization_id: string;
  role: 'admin' | 'member' | 'viewer';
  is_active: boolean;
  organization: Organization;
}

// Enhanced context type with multi-tenancy support
type MultiTenantAuthContextType = {
  supabase: SupabaseClient;
  user: User | null;
  loading: boolean;
  
  // Organization context
  currentOrganization: Organization | null;
  userOrganizations: UserOrganization[];
  isOrgAdmin: boolean;
  isSuperAdmin: boolean; // Global admin across all orgs
  
  // Auth methods
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
  
  // Organization methods
  switchOrganization: (organizationId: string, orgsArray?: UserOrganization[]) => Promise<void>;
  createOrganization: (name: string, slug: string) => Promise<{ data: Organization | null; error: any }>;
  inviteUserToOrg: (email: string, role: 'admin' | 'member' | 'viewer') => Promise<{ error: any }>;
  updateUserRole: (userId: string, role: 'admin' | 'member' | 'viewer') => Promise<{ error: any }>;
};

// Environment variables
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

console.log('🏢 Multi-Tenant Auth: Environment Variables Debug');
console.log('- VITE_SUPABASE_URL:', supabaseUrl);
console.log('- VITE_SUPABASE_ANON_KEY:', supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'undefined');

const hasValidConfig = Boolean(supabaseUrl && supabaseKey);

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

// Default context value
const defaultContextValue: MultiTenantAuthContextType = {
  supabase,
  user: null,
  loading: true,
  currentOrganization: null,
  userOrganizations: [],
  isOrgAdmin: false,
  isSuperAdmin: false,
  signIn: async () => ({ data: null, error: { message: 'AuthProvider not mounted' } }),
  signUp: async () => ({ data: null, error: { message: 'AuthProvider not mounted' } }),
  signOut: async () => { console.error('AuthProvider not mounted'); },
  resetPassword: async () => ({ data: null, error: { message: 'AuthProvider not mounted' } }),
  switchOrganization: async () => {},
  createOrganization: async () => ({ data: null, error: { message: 'AuthProvider not mounted' } }),
  inviteUserToOrg: async () => ({ error: { message: 'AuthProvider not mounted' } }),
  updateUserRole: async () => ({ error: { message: 'AuthProvider not mounted' } })
};

export const MultiTenantAuthContext = createContext<MultiTenantAuthContextType>(defaultContextValue);

export const MultiTenantAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [userOrganizations, setUserOrganizations] = useState<UserOrganization[]>([]);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);

  // Helper function to check if user is super admin (global)
  const checkSuperAdminStatus = (user: User | null): boolean => {
    if (!user) return false;
    const adminFlag = user.user_metadata?.is_admin;
    return adminFlag === true || adminFlag === 'true';
  };

  // Load user's organizations and set current org
  const loadUserOrganizations = async (userId: string) => {
    // Prevent concurrent calls
    if (loadingOrganizations) {
      console.log('🏢 DEBUG: loadUserOrganizations already in progress, skipping...');
      return;
    }
    
    setLoadingOrganizations(true);
    try {
      console.log('🏢 Loading organizations for user:', userId);
      console.log('🏢 DEBUG: About to execute Supabase query...');
      
      // Add timeout to prevent hanging
      const queryPromise = supabase
        .from('user_organizations')
        .select(`
          id,
          user_id,
          organization_id,
          role,
          is_active,
          organization:organizations!inner(
            id,
            name,
            slug,
            is_active,
            settings,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true);
      
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 10 seconds')), 10000)
      );
      
      const result = await Promise.race([queryPromise, timeoutPromise]);
      const { data: orgs, error } = result;

      console.log('🏢 DEBUG: Supabase query completed');
      console.log('🏢 DEBUG: Raw query result - data:', orgs);
      console.log('🏢 DEBUG: Raw query result - error:', error);

      if (error) {
        console.error('🚨 Error loading organizations:', error);
        console.error('🚨 Error details:', JSON.stringify(error, null, 2));
        console.error('🚨 This usually means the database migration has not been run yet!');
        console.error('🚨 Please run the SQL migration in Supabase SQL Editor');
        
        // Don't let this error block the app - set empty organizations and continue
        console.log('🏢 DEBUG: Setting empty organizations due to error');
        setUserOrganizations([]);
        setCurrentOrganization(null);
        setIsOrgAdmin(false);
        setLoadingOrganizations(false);
        console.log('🏢 DEBUG: Early return due to error - loadUserOrganizations complete');
        return;
      }

      console.log('🏢 Found organizations:', orgs?.length || 0);
      console.log('🏢 DEBUG: Organizations data:', JSON.stringify(orgs, null, 2));
      
      if (!orgs || orgs.length === 0) {
        console.log('🏢 No organizations found for user. This is normal for new users before migration.');
        console.log('🏢 DEBUG: Setting empty organizations - no orgs found');
        setUserOrganizations([]);
        setCurrentOrganization(null);
        setIsOrgAdmin(false);
        
        // Check if user is super admin
        const isSuperAdmin = checkSuperAdminStatus(user);
        console.log('🏢 DEBUG: User super admin status:', isSuperAdmin);
        
        // If user is super admin but has no orgs, create a default one
        if (isSuperAdmin) {
          console.log('🏢 Creating default organization for super admin');
          await createDefaultOrganization(userId);
        }
        setLoadingOrganizations(false);
        console.log('🏢 DEBUG: Early return due to no orgs - loadUserOrganizations complete');
        return;
      }
      
      // Transform the data to match our UserOrganization interface
      console.log('🏢 DEBUG: Transforming organizations data...');
      const transformedOrgs = orgs?.map(org => ({
        ...org,
        organization: Array.isArray(org.organization) ? org.organization[0] : org.organization
      })) || [];
      
      console.log('🏢 DEBUG: Transformed organizations:', JSON.stringify(transformedOrgs, null, 2));
      setUserOrganizations(transformedOrgs as UserOrganization[]);

      // Set current organization (from localStorage, or first admin org, or first org)
      const savedOrgId = localStorage.getItem('currentOrganizationId');
      console.log('🏢 DEBUG: Saved organization ID from localStorage:', savedOrgId);
      let targetOrg: UserOrganization | undefined;

      if (savedOrgId) {
        targetOrg = transformedOrgs.find(org => org.organization_id === savedOrgId);
        console.log('🏢 DEBUG: Found saved org:', targetOrg ? targetOrg.organization.name : 'not found');
      }
      
      if (!targetOrg && transformedOrgs.length > 0) {
        const adminOrg = transformedOrgs.find(org => org.role === 'admin');
        targetOrg = adminOrg || transformedOrgs[0];
        console.log('🏢 DEBUG: Selected fallback org:', targetOrg ? targetOrg.organization.name : 'none');
      }

      if (targetOrg) {
        console.log('🏢 DEBUG: About to switch to organization:', targetOrg.organization.name);
        await switchOrganization(targetOrg.organization_id, transformedOrgs as UserOrganization[]);
        console.log('🏢 DEBUG: Organization switch completed');
      } else if (checkSuperAdminStatus(user)) {
        // No organizations - create a default one for super admin
        console.log('🏢 No organizations found, creating default for super admin');
        await createDefaultOrganization(userId);
      }
      
      console.log('🏢 DEBUG: loadUserOrganizations completed successfully');
    } catch (error) {
      console.error('🚨 Unexpected error in loadUserOrganizations:', error);
      console.error('🚨 Error stack:', error instanceof Error ? error.stack : 'No stack available');
      // Don't let this error block the app
      setUserOrganizations([]);
      setCurrentOrganization(null);
      setIsOrgAdmin(false);
      console.log('🏢 DEBUG: Exception handled - loadUserOrganizations complete');
    } finally {
      setLoadingOrganizations(false);
      console.log('🏢 DEBUG: loadingOrganizations set to false');
    }
  };

  // Create default organization for new users
  const createDefaultOrganization = async (userId: string) => {
    try {
      const userEmail = user?.email || 'user';
      const orgName = `${userEmail.split('@')[0]}'s Organization`;
      const orgSlug = `${userEmail.split('@')[0]}-org-${Date.now()}`;

      const result = await createOrganization(orgName, orgSlug);
      if (result.data) {
        console.log('🏢 Created default organization:', result.data.name);
      }
    } catch (error) {
      console.error('Error creating default organization:', error);
    }
  };

  // Switch to a different organization (with optional orgs array for fresh data)
  const switchOrganization = async (organizationId: string, orgsArray?: UserOrganization[]) => {
    try {
      console.log('🏢 Switching to organization:', organizationId);
      
      // Use provided orgs array or fall back to state (for fresh data scenarios)
      const orgsToSearch = orgsArray || userOrganizations;
      console.log('🏢 DEBUG: Searching in', orgsToSearch.length, 'organizations');
      
      const org = orgsToSearch.find(uo => uo.organization_id === organizationId);
      if (!org) {
        console.error('🏢 Organization not found in user orgs. Available orgs:', orgsToSearch.map(o => o.organization_id));
        return;
      }

      setCurrentOrganization(org.organization);
      setIsOrgAdmin(org.role === 'admin');
      
      // Store in localStorage for persistence
      localStorage.setItem('currentOrganizationId', organizationId);
      
      console.log('🏢 Switched to org:', org.organization.name, 'Role:', org.role);
      
      // Dispatch custom event for other components to react to org change
      window.dispatchEvent(new CustomEvent('organizationChanged', { 
        detail: { organizationId, organization: org.organization } 
      }));
    } catch (error) {
      console.error('Error switching organization:', error);
    }
  };

  // Create new organization
  const createOrganization = async (name: string, slug: string): Promise<{ data: Organization | null; error: any }> => {
    try {
      if (!user) {
        return { data: null, error: { message: 'User not authenticated' } };
      }

      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name, slug })
        .select()
        .single();

      if (orgError) {
        return { data: null, error: orgError };
      }

      // Add user as admin
      const { error: memberError } = await supabase
        .from('user_organizations')
        .insert({
          user_id: user.id,
          organization_id: org.id,
          role: 'admin'
        });

      if (memberError) {
        return { data: null, error: memberError };
      }

      // Reload organizations
      await loadUserOrganizations(user.id);

      return { data: org, error: null };
    } catch (error) {
      console.error('Error creating organization:', error);
      return { data: null, error };
    }
  };

  // Invite user to current organization
  const inviteUserToOrg = async (email: string, role: 'admin' | 'member' | 'viewer'): Promise<{ error: any }> => {
    try {
      if (!currentOrganization || !isOrgAdmin) {
        return { error: { message: 'Not authorized to invite users' } };
      }

      // This would typically send an invitation email
      // For now, we'll just log it
      console.log(`🏢 Inviting ${email} as ${role} to ${currentOrganization.name}`);
      
      toast.info(`Invitation feature coming soon! Would invite ${email} as ${role}`);
      return { error: null };
    } catch (error) {
      console.error('Error inviting user:', error);
      return { error };
    }
  };

  // Update user role in current organization
  const updateUserRole = async (userId: string, role: 'admin' | 'member' | 'viewer'): Promise<{ error: any }> => {
    try {
      if (!currentOrganization || !isOrgAdmin) {
        return { error: { message: 'Not authorized to update user roles' } };
      }

      const { error } = await supabase
        .from('user_organizations')
        .update({ role })
        .eq('user_id', userId)
        .eq('organization_id', currentOrganization.id);

      if (!error) {
        // Reload organizations to update state
        if (user) {
          await loadUserOrganizations(user.id);
        }
      }

      return { error };
    } catch (error) {
      console.error('Error updating user role:', error);
      return { error };
    }
  };

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      console.log('🏢 Multi-Tenant Auth: Initializing...');
      
      try {
        if (!hasValidConfig) {
          console.warn('Supabase environment variables not configured');
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user && mounted) {
          console.log('🏢 Found existing session:', session.user.email);
          setUser(session.user);
          setIsSuperAdmin(checkSuperAdminStatus(session.user));
          await loadUserOrganizations(session.user.id);
        } else {
          console.log('🏢 No existing session');
          setUser(null);
          setIsSuperAdmin(false);
        }
        
        if (mounted) {
          setLoading(false);
        }
        
      } catch (error) {
        console.error('🏢 Auth initialization error:', error);
        if (mounted) {
          setUser(null);
          setIsSuperAdmin(false);
          setLoading(false);
        }
      }
    };

    initAuth();

    // Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🏢 Auth state change:', event);
      console.log('🏢 DEBUG: Auth state change - mounted:', mounted);
      console.log('🏢 DEBUG: Auth state change - session user:', session?.user?.email || 'none');
      
      if (mounted) {
        if (session?.user) {
          console.log('🏢 DEBUG: Setting user and loading organizations...');
          setUser(session.user);
          const isSuperAdmin = checkSuperAdminStatus(session.user);
          setIsSuperAdmin(isSuperAdmin);
          
          // Update admin exists cache when a super admin logs in
          if (isSuperAdmin) {
            console.log('🏢 Super admin logged in, updating admin status cache');
            localStorage.setItem('adminExists', 'true');
          }
          
          console.log('🏢 DEBUG: About to call loadUserOrganizations...');
          await loadUserOrganizations(session.user.id);
          console.log('🏢 DEBUG: loadUserOrganizations call completed');
        } else {
          console.log('🏢 DEBUG: No user, clearing state...');
          setUser(null);
          setIsSuperAdmin(false);
          setCurrentOrganization(null);
          setUserOrganizations([]);
          setIsOrgAdmin(false);
          localStorage.removeItem('currentOrganizationId');
        }
        console.log('🏢 DEBUG: Setting loading to false...');
        setLoading(false);
        console.log('🏢 DEBUG: Auth state change complete - loading set to false');
      } else {
        console.log('🏢 DEBUG: Component not mounted, skipping state updates');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Auth methods (similar to original but with org context)
  const signIn = async (email: string, password: string) => {
    try {
      if (!hasValidConfig) {
        return { 
          data: null, 
          error: { message: 'Supabase not configured. Please set up environment variables.' }
        };
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
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
    console.log('🏢 Multi-Tenant Auth: Signing out...');
    
    try {
      // Clear state
      setUser(null);
      setIsSuperAdmin(false);
      setCurrentOrganization(null);
      setUserOrganizations([]);
      setIsOrgAdmin(false);
      
      // Clear storage
      localStorage.removeItem('currentOrganizationId');
      
      if (hasValidConfig) {
        const { error } = await supabase.auth.signOut({ scope: 'global' });
        if (error) {
          console.error('Supabase signOut error:', error);
        }
      }
      
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      if (!hasValidConfig) {
        return { 
          data: null, 
          error: { message: 'Supabase not configured. Please set up environment variables.' }
        };
      }
      
      const { data, error } = await supabase.auth.resetPasswordForEmail(email);
      return { data, error };
    } catch (error) {
      console.error('Reset password error:', error);
      return { data: null, error };
    }
  };

  const contextValue: MultiTenantAuthContextType = {
    supabase,
    user,
    loading,
    currentOrganization,
    userOrganizations,
    isOrgAdmin,
    isSuperAdmin,
    signIn,
    signUp,
    signOut,
    resetPassword,
    switchOrganization,
    createOrganization,
    inviteUserToOrg,
    updateUserRole
  };

  return (
    <MultiTenantAuthContext.Provider value={contextValue}>
      {children}
    </MultiTenantAuthContext.Provider>
  );
}; 