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

    // For now, allow any user to become super admin
    // In production, you might want to add additional checks here

    // Update user metadata to mark as super admin
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          is_admin: true
        }
      }
    );

    if (updateError) {
      console.error('Error updating user metadata:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update user metadata',
        details: updateError.message 
      });
    }

    console.log('✅ Successfully set super admin status for user:', user.email);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Super admin status granted successfully',
      user: {
        id: user.id,
        email: user.email,
        is_admin: true
      }
    });

  } catch (error) {
    console.error('❌ Set super admin error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
} 