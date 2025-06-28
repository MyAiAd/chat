import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 Checking super admin eligibility...');

    // Check if we have required environment variables
    if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ 
        error: 'Missing required environment variables' 
      });
    }

    // Get the user's auth token from the request
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Create Supabase clients
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const supabaseClient = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );

    // Verify the user's token and get their ID
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth verification failed:', authError);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    console.log('🔍 Checking eligibility for user:', user.email);

    // Check if user is already super admin
    const isAlreadyAdmin = user.user_metadata?.is_admin === true || user.user_metadata?.is_admin === 'true';
    if (isAlreadyAdmin) {
      console.log('🔍 User is already super admin');
      return res.status(200).json({ 
        canBecomeSuperAdmin: false,
        reason: 'User is already super admin'
      });
    }

    // Check total number of users in the system
    const { data: allUsers, error: userCountError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userCountError) {
      console.error('Error checking user count:', userCountError);
      return res.status(500).json({ 
        error: 'Failed to verify user count',
        details: userCountError.message 
      });
    }

    const totalUsers = allUsers?.users?.length || 0;
    console.log('🔍 Total users in system:', totalUsers);

    // Only eligible if there's exactly 1 user (this user) in the system
    const canBecomeSuperAdmin = totalUsers === 1;
    
    console.log('🔍 Can become super admin:', canBecomeSuperAdmin);
    
    return res.status(200).json({ 
      canBecomeSuperAdmin,
      totalUsers,
      reason: canBecomeSuperAdmin 
        ? 'User is the only user in the system' 
        : `Cannot become platform owner when ${totalUsers} users exist`
    });

  } catch (error) {
    console.error('❌ Eligibility check error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
} 