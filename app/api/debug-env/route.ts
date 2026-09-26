export async function GET() {
  return Response.json({
    has_SUPABASE_URL: !!process.env.SUPABASE_URL,
    has_PUBLISHABLE: !!process.env.SUPABASE_PUBLISHABLE_KEY,
    has_SECRET: !!process.env.SUPABASE_SECRET_KEY,
    has_NEXT_PUBLIC_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    has_NEXT_PUBLIC_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    has_VERIFY: !!process.env.VERIFY_TOKEN,
    has_WA_TOKEN: !!process.env.WHATSAPP_TOKEN,
    vercel_env: process.env.VERCEL_ENV,
  })
}
