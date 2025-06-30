import { useState, useEffect } from 'react';

interface AdminStatusResult {
  adminExists: boolean;
  totalUsers: number;
  loading: boolean;
  error: string | null;
}

export const useAdminStatus = (): AdminStatusResult => {
  const [adminExists, setAdminExists] = useState<boolean>(false);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        console.log('🔍 Checking admin status...');
        setLoading(true);
        setError(null);

        // Check localStorage for cached admin status
        const cachedAdminStatus = localStorage.getItem('adminExists');
        if (cachedAdminStatus !== null) {
          const adminExists = cachedAdminStatus === 'true';
          console.log('✅ Using cached admin status:', adminExists);
          setAdminExists(adminExists);
          setTotalUsers(adminExists ? 1 : 0);
          return;
        }

        // For now, we'll use a simple approach:
        // If the app has been used before (has any localStorage data from auth),
        // assume an admin exists. Otherwise, assume first-time setup.
        
        const hasAuthData = Object.keys(localStorage).some(key => 
          key.startsWith('sb-') || key.includes('supabase')
        );

        if (hasAuthData) {
          console.log('✅ Found auth data, assuming admin exists');
          setAdminExists(true);
          setTotalUsers(1);
          // Cache the result
          localStorage.setItem('adminExists', 'true');
        } else {
          console.log('🔍 No auth data found, assuming first-time setup');
          setAdminExists(false);
          setTotalUsers(0);
          // Don't cache 'false' as it might change when admin is created
        }

      } catch (err) {
        console.error('❌ Error checking admin status:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Default to requiring authentication on error
        setAdminExists(false);
        setTotalUsers(0);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, []);

  return {
    adminExists,
    totalUsers,
    loading,
    error
  };
}; 