-- Chat Database Diagnostic Script
-- Run this in Supabase SQL Editor to check current state

-- 1. Check if chat tables exist
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name IN ('chat_conversations', 'chat_messages', 'ai_api_keys', 'rag_documents')
ORDER BY table_name;

-- 2. Check table structure for chat_conversations
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'chat_conversations'
ORDER BY ordinal_position;

-- 3. Check if RLS is enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('chat_conversations', 'chat_messages', 'ai_api_keys', 'rag_documents');

-- 4. Check current RLS policies
SELECT 
    tablename,
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('chat_conversations', 'chat_messages', 'ai_api_keys', 'rag_documents')
ORDER BY tablename, policyname;

-- 5. Check current user authentication context
SELECT 
    'Current user ID:' as info,
    auth.uid() as user_id;

-- 6. Try to test the policy (this might fail if policies are wrong)
-- This is just a test - we won't actually insert data
EXPLAIN (FORMAT TEXT) 
SELECT * FROM chat_conversations WHERE user_id = auth.uid();

-- 7. Show any existing chat_conversations data (will be empty if none exist)
SELECT 
    id,
    user_id,
    title,
    ai_provider,
    created_at
FROM chat_conversations 
LIMIT 5; 