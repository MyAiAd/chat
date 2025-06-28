-- Set Platform Super Admin
-- Run this SQL in your Supabase SQL Editor to make sage@myai.ad the platform owner

-- Update user metadata to mark sage@myai.ad as super admin
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_admin": true}'::jsonb
WHERE email = 'sage@myai.ad';

-- Verify the update
SELECT 
    email,
    raw_user_meta_data,
    raw_user_meta_data->>'is_admin' as is_admin_flag
FROM auth.users 
WHERE email = 'sage@myai.ad';

-- If you want to check all users (optional)
-- SELECT email, raw_user_meta_data->>'is_admin' as is_admin_flag FROM auth.users; 