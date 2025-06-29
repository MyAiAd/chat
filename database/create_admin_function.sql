-- Create function to set user as super admin
-- This function has the necessary privileges to update auth.users.raw_user_meta_data

CREATE OR REPLACE FUNCTION set_user_super_admin(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Run with elevated privileges
AS $$
DECLARE
    result JSON;
BEGIN
    -- Update the user's raw_user_meta_data to include is_admin: true
    UPDATE auth.users 
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_admin": true}'::jsonb
    WHERE id = target_user_id;
    
    -- Check if the update was successful
    IF FOUND THEN
        -- Return success with updated user info
        SELECT json_build_object(
            'success', true,
            'message', 'Super admin privileges granted successfully',
            'user_id', target_user_id,
            'is_admin', true
        ) INTO result;
    ELSE
        -- User not found
        SELECT json_build_object(
            'success', false,
            'error', 'User not found',
            'user_id', target_user_id
        ) INTO result;
    END IF;
    
    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION set_user_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_super_admin(UUID) TO service_role;

-- Verify the function was created
SELECT proname, proargtypes, prosecdef 
FROM pg_proc 
WHERE proname = 'set_user_super_admin'; 