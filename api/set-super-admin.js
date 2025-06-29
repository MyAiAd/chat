import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔧 Set super admin API called');

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

    console.log('🔧 Setting super admin status for user:', user.email);

    // SECURITY: Only allow if this is the ONLY user in the system
    console.log('🔒 Checking if user is the only user in the system...');
    
    const { data: allUsers, error: userCountError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userCountError) {
      console.error('Error checking user count:', userCountError);
      return res.status(500).json({ 
        error: 'Failed to verify user count',
        details: userCountError.message 
      });
    }

    const totalUsers = allUsers?.users?.length || 0;
    console.log('🔒 Total users in system:', totalUsers);

    // Only allow if there's exactly 1 user (this user) in the system
    if (totalUsers !== 1) {
      console.log('🚫 SECURITY: Blocked super admin promotion - other users exist');
      return res.status(403).json({ 
        error: 'Super admin promotion not allowed',
        details: `Cannot become platform owner when ${totalUsers} users exist. Only the first user can become platform owner.`
      });
    }

    console.log('✅ SECURITY: User is the only user in system, allowing promotion');

    // Call our custom function to update raw_user_meta_data properly
    const { error: adminUpdateError } = await supabaseAdmin.rpc('set_user_super_admin', {
      target_user_id: user.id
    });

    if (adminUpdateError) {
      console.error('Error calling set_user_super_admin function:', adminUpdateError);
      return res.status(500).json({ 
        error: 'Failed to grant super admin privileges',
        details: adminUpdateError.message
      });
    }

    // Also update user_metadata for immediate frontend consistency
    const { data: metaUpdatedUser, error: metaError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          is_admin: true
        }
      }
    );

    if (metaError) {
      console.warn('Warning: user_metadata update failed:', metaError);
      // Continue since the main update succeeded
    }

    // Verify the update worked by getting fresh user data
    const { data: { user: verifiedUser }, error: refreshError } = await supabaseAdmin.auth.admin.getUserById(user.id);
    
    if (refreshError || !verifiedUser) {
      console.error('Error verifying user update:', refreshError);
      return res.status(500).json({ 
        error: 'Admin status update verification failed',
        details: refreshError?.message || 'Could not verify user update'
      });
    }

    console.log('✅ Successfully set super admin status for user:', user.email);
    console.log('✅ Verified admin status in database:', {
      user_metadata: verifiedUser.user_metadata?.is_admin,
      raw_user_meta_data: verifiedUser.raw_user_meta_data?.is_admin
    });
    
    return res.status(200).json({ 
      success: true, 
      message: 'Super admin status granted successfully. Please sign out and sign back in to refresh your session.',
      user: {
        id: user.id,
        email: user.email,
        is_admin: true
      },
      requiresReauth: true
    });

  } catch (error) {
    console.error('❌ Set super admin error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
} 