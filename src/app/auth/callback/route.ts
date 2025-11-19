import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Ensure there is a corresponding row in the application `users` table
      // (Supabase Auth creates an auth.users entry but our schema has a
      // separate `users` table that references auth.users(id)). Create or
      // upsert a minimal users row so FK constraints (e.g., wants.user_id)
      // won't fail when the app later inserts rows tied to this user.
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser()
        if (!userErr && userData?.user) {
          const u = userData.user
          // Upsert into `users` table using auth user's id
          const upsertPayload = {
            id: u.id,
            email: u.email,
            name: (u.user_metadata as any)?.full_name ?? u.user_metadata?.name ?? null,
            updated_at: new Date().toISOString(),
          }
          const { error: upsertErr } = await (supabase.from('users') as any).upsert(upsertPayload as any)
          if (upsertErr) {
            // Log but don't block redirect; app will still have a valid session
            console.error('Failed to upsert users row after auth callback:', upsertErr)
          }
        }
      } catch (e) {
        console.error('Error ensuring users row after auth callback:', e)
      }

      const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}