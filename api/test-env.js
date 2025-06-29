export default async function handler(req, res) {
  console.log('🔍 Environment Variables Test');
  
  const envStatus = {
    VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: !!process.env.VITE_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NODE_ENV: process.env.NODE_ENV
  };
  
  console.log('Environment status:', envStatus);
  
  return res.status(200).json({
    message: 'Environment check complete',
    ...envStatus
  });
} 