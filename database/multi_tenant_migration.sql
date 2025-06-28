-- Multi-Tenant Migration Script
-- This script adds proper multi-tenancy support to the AI Chat application
-- Run this in your Supabase SQL Editor AFTER the main setup

-- 1. Create Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}'::jsonb
);

-- 2. Create User-Organization relationships table
CREATE TABLE IF NOT EXISTS user_organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'member', 'viewer')) DEFAULT 'member',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, organization_id)
);

-- 3. Add organization_id to existing tables
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations(is_active);
CREATE INDEX IF NOT EXISTS idx_user_organizations_user_id ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_org_id ON user_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_role ON user_organizations(role);
CREATE INDEX IF NOT EXISTS idx_rag_documents_organization_id ON rag_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_organization_id ON chat_conversations(organization_id);

-- 5. Enable RLS on new tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

-- 6. Create helper function to get user's organizations
CREATE OR REPLACE FUNCTION get_user_organizations(user_uuid UUID)
RETURNS TABLE(organization_id UUID, role VARCHAR(50))
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT uo.organization_id, uo.role
    FROM user_organizations uo
    WHERE uo.user_id = user_uuid 
    AND uo.is_active = true;
$$;

-- 7. Create helper function to check if user is org admin
CREATE OR REPLACE FUNCTION is_organization_admin(user_uuid UUID, org_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_organizations
        WHERE user_id = user_uuid 
        AND organization_id = org_uuid
        AND role = 'admin'
        AND is_active = true
    );
$$;

-- 8. Drop existing RAG document policies
DROP POLICY IF EXISTS "All users can view active RAG documents" ON rag_documents;
DROP POLICY IF EXISTS "Admins can insert RAG documents" ON rag_documents;
DROP POLICY IF EXISTS "Admins can update RAG documents" ON rag_documents;
DROP POLICY IF EXISTS "Admins can delete RAG documents" ON rag_documents;

-- 9. Create new organization-scoped RAG document policies
CREATE POLICY "Users can view documents from their organizations" ON rag_documents
    FOR SELECT USING (
        is_active = true 
        AND organization_id IN (
            SELECT organization_id 
            FROM get_user_organizations(auth.uid())
        )
    );

CREATE POLICY "Organization admins can insert documents" ON rag_documents
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM get_user_organizations(auth.uid())
            WHERE role = 'admin'
        )
    );

CREATE POLICY "Organization admins can update documents" ON rag_documents
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id 
            FROM get_user_organizations(auth.uid())
            WHERE role = 'admin'
        )
    );

CREATE POLICY "Organization admins can delete documents" ON rag_documents
    FOR DELETE USING (
        organization_id IN (
            SELECT organization_id 
            FROM get_user_organizations(auth.uid())
            WHERE role = 'admin'
        )
    );

-- 10. Update chat conversation policies for organizations
DROP POLICY IF EXISTS "Users can view their own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON chat_conversations;

CREATE POLICY "Users can view conversations from their organizations" ON chat_conversations
    FOR SELECT USING (
        auth.uid() = user_id 
        AND (
            organization_id IS NULL -- Backward compatibility
            OR organization_id IN (
                SELECT organization_id 
                FROM get_user_organizations(auth.uid())
            )
        )
    );

CREATE POLICY "Users can insert conversations in their organizations" ON chat_conversations
    FOR INSERT WITH CHECK (
        auth.uid() = user_id 
        AND (
            organization_id IS NULL -- Backward compatibility
            OR organization_id IN (
                SELECT organization_id 
                FROM get_user_organizations(auth.uid())
            )
        )
    );

CREATE POLICY "Users can update their own conversations" ON chat_conversations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" ON chat_conversations
    FOR DELETE USING (auth.uid() = user_id);

-- 11. Create organization policies
CREATE POLICY "Users can view their organizations" ON organizations
    FOR SELECT USING (
        id IN (
            SELECT organization_id 
            FROM get_user_organizations(auth.uid())
        )
    );

CREATE POLICY "Organization admins can update their organization" ON organizations
    FOR UPDATE USING (
        id IN (
            SELECT organization_id 
            FROM get_user_organizations(auth.uid())
            WHERE role = 'admin'
        )
    );

-- 12. Create user_organizations policies
CREATE POLICY "Users can view their organization memberships" ON user_organizations
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Organization admins can manage memberships" ON user_organizations
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id 
            FROM get_user_organizations(auth.uid())
            WHERE role = 'admin'
        )
    );

-- 13. Grant permissions
GRANT ALL ON organizations TO authenticated;
GRANT ALL ON user_organizations TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_organizations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_organization_admin(UUID, UUID) TO authenticated;

-- 14. Create default organization for existing users and migrate data
-- Create a default organization
INSERT INTO organizations (id, name, slug) 
VALUES (gen_random_uuid(), 'Default Organization', 'default-org')
ON CONFLICT (slug) DO NOTHING;

-- Get the default org ID and migrate existing data
DO $$
DECLARE
    default_org_id UUID;
BEGIN
    SELECT id INTO default_org_id FROM organizations WHERE slug = 'default-org';
    
    -- Add all existing users to default org (admins as admin, others as members)
    INSERT INTO user_organizations (user_id, organization_id, role)
    SELECT 
        id, 
        default_org_id, 
        CASE 
            WHEN raw_user_meta_data->>'is_admin' = 'true' THEN 'admin'
            ELSE 'member'
        END
    FROM auth.users
    ON CONFLICT (user_id, organization_id) DO NOTHING;
    
    -- Update existing documents to belong to default org
    UPDATE rag_documents 
    SET organization_id = default_org_id 
    WHERE organization_id IS NULL;
    
    -- Update existing conversations to belong to default org
    UPDATE chat_conversations 
    SET organization_id = default_org_id 
    WHERE organization_id IS NULL;
    
    RAISE NOTICE 'Migrated existing data to default organization: %', default_org_id;
END $$;

SELECT 'Multi-tenant migration completed successfully!' as result; 