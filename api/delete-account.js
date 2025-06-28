import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 Delete account API called');
    console.log('🔍 Environment check:', {
      hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
      hasAnonKey: !!process.env.VITE_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });

    // Check if we have required environment variables
    if (!process.env.VITE_SUPABASE_URL) {
      console.error('❌ Missing VITE_SUPABASE_URL');
      return res.status(500).json({ error: 'Missing Supabase URL configuration' });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
      return res.status(500).json({ 
        error: 'Missing service role key configuration',
        details: 'SUPABASE_SERVICE_ROLE_KEY environment variable is required for admin operations'
      });
    }

    // Get the user's auth token from the request
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Missing or invalid auth header');
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('✅ Auth token received');

    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY, // This is the admin key
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('✅ Supabase admin client created');

    // Create regular client to verify the user's token
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

    const userId = user.id;
    console.log('🗑️ Starting account deletion for user:', userId);

    // 1. Get user's conversation IDs first, then delete messages
    const { data: userConversations } = await supabaseAdmin
      .from('chat_conversations')
      .select('id')
      .eq('user_id', userId);

    if (userConversations && userConversations.length > 0) {
      const conversationIds = userConversations.map(conv => conv.id);
      const { error: messagesError } = await supabaseAdmin
        .from('chat_messages')
        .delete()
        .in('conversation_id', conversationIds);

      if (messagesError) {
        console.error('Error deleting messages:', messagesError);
        // Continue anyway - we'll delete what we can
      } else {
        console.log('✅ Deleted messages for', conversationIds.length, 'conversations');
      }
    }

    // 2. Delete user's conversations
    const { error: conversationsError } = await supabaseAdmin
      .from('chat_conversations')
      .delete()
      .eq('user_id', userId);

    if (conversationsError) {
      console.error('Error deleting conversations:', conversationsError);
      // Continue anyway
    } else {
      console.log('✅ Deleted user conversations');
    }

    // 3. Delete user's API keys
    const { error: apiKeysError } = await supabaseAdmin
      .from('ai_api_keys')
      .delete()
      .eq('user_id', userId);

    if (apiKeysError) {
      console.error('Error deleting API keys:', apiKeysError);
      // Continue anyway
    } else {
      console.log('✅ Deleted user API keys');
    }

    // 4. Delete user's organization memberships
    const { error: orgMembershipsError } = await supabaseAdmin
      .from('user_organizations')
      .delete()
      .eq('user_id', userId);

    if (orgMembershipsError) {
      console.error('Error deleting organization memberships:', orgMembershipsError);
      // Continue anyway
    } else {
      console.log('✅ Deleted user organization memberships');
    }

    // 5. Finally, delete the user account itself using admin client
    const { error: userDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (userDeleteError) {
      console.error('Error deleting user account:', userDeleteError);
      return res.status(500).json({ 
        error: 'Failed to delete user account',
        details: userDeleteError.message 
      });
    }

    console.log('✅ Successfully deleted user account:', userId);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Account deleted successfully' 
    });

  } catch (error) {
    console.error('❌ Account deletion error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
} 