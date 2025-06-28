-- Complete AI Chat System Fix
-- Run this script in Supabase SQL Editor to fix the 403 error

-- Step 1: Ensure tables exist with correct structure
CREATE TABLE IF NOT EXISTS ai_api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('openai', 'openrouter', 'anthropic')),
    api_key_encrypted TEXT NOT NULL,
    api_key_name VARCHAR(100) DEFAULT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS rag_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    file_type VARCHAR(50) DEFAULT 'text',
    file_size INTEGER DEFAULT NULL,
    tags TEXT[] DEFAULT '{}',
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    rag_documents_used UUID[] DEFAULT '{}',
    token_count INTEGER DEFAULT NULL,
    cost_estimate DECIMAL(10,6) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 2: Enable RLS
ALTER TABLE ai_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own API keys" ON ai_api_keys;
DROP POLICY IF EXISTS "Users can insert their own API keys" ON ai_api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON ai_api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON ai_api_keys;

DROP POLICY IF EXISTS "All users can view active RAG documents" ON rag_documents;
DROP POLICY IF EXISTS "Admins can insert RAG documents" ON rag_documents;
DROP POLICY IF EXISTS "Admins can update RAG documents" ON rag_documents;
DROP POLICY IF EXISTS "Admins can delete RAG documents" ON rag_documents;

DROP POLICY IF EXISTS "Users can view their own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON chat_conversations;

DROP POLICY IF EXISTS "Users can view messages from their own conversations" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert messages to their own conversations" ON chat_messages;
DROP POLICY IF EXISTS "Users can update messages in their own conversations" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete messages from their own conversations" ON chat_messages;

-- Step 4: Create correct RLS policies

-- API Keys policies
CREATE POLICY "Users can view their own API keys" ON ai_api_keys
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own API keys" ON ai_api_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys" ON ai_api_keys
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys" ON ai_api_keys
    FOR DELETE USING (auth.uid() = user_id);

-- RAG Documents policies
CREATE POLICY "All users can view active RAG documents" ON rag_documents
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can insert RAG documents" ON rag_documents
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'is_admin' = 'true'
        )
    );

CREATE POLICY "Admins can update RAG documents" ON rag_documents
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'is_admin' = 'true'
        )
    );

CREATE POLICY "Admins can delete RAG documents" ON rag_documents
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'is_admin' = 'true'
        )
    );

-- Chat Conversations policies (FIXED)
CREATE POLICY "Users can view their own conversations" ON chat_conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations" ON chat_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON chat_conversations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" ON chat_conversations
    FOR DELETE USING (auth.uid() = user_id);

-- Chat Messages policies (FIXED)
CREATE POLICY "Users can view messages from their own conversations" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_conversations 
            WHERE id = conversation_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages to their own conversations" ON chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_conversations 
            WHERE id = conversation_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update messages in their own conversations" ON chat_messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM chat_conversations 
            WHERE id = conversation_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete messages from their own conversations" ON chat_messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM chat_conversations 
            WHERE id = conversation_id 
            AND user_id = auth.uid()
        )
    );

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_api_keys_user_id ON ai_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_api_keys_provider ON ai_api_keys(provider);
CREATE INDEX IF NOT EXISTS idx_rag_documents_uploaded_by ON rag_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_rag_documents_is_active ON rag_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Step 6: Verify the fix
SELECT 'Chat system setup complete!' as status;
SELECT tablename, policyname, cmd FROM pg_policies 
WHERE tablename IN ('chat_conversations', 'chat_messages')
ORDER BY tablename, policyname; 