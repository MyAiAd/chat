-- URGENT FIX: Chat Conversations 403 Error
-- This script fixes the RLS policy issue causing the 403 error

-- 1. Check if the table exists and create it if it doesn't
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'New Conversation',
    ai_provider VARCHAR(50) NOT NULL CHECK (ai_provider IN ('openai', 'openrouter', 'anthropic')),
    model_name VARCHAR(100) DEFAULT NULL,
    system_prompt TEXT DEFAULT NULL,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable RLS (this might already be enabled)
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

-- 3. Drop any existing broken policies
DROP POLICY IF EXISTS "Users can view their own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON chat_conversations;

-- 4. Create WORKING RLS policies
CREATE POLICY "Users can view their own conversations" ON chat_conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations" ON chat_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON chat_conversations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" ON chat_conversations
    FOR DELETE USING (auth.uid() = user_id);

-- 5. Test the fix with current user (THIS SHOULD WORK NOW)
-- Note: This is just a test query, it won't actually insert anything
SELECT 
    'Fix applied successfully!' as status,
    'Current user:' as info,
    auth.uid() as current_user_id,
    'Table ready for inserts' as ready;

-- 6. Verify policies are created correctly
SELECT 
    policyname,
    cmd,
    permissive
FROM pg_policies 
WHERE tablename = 'chat_conversations'
ORDER BY policyname; 