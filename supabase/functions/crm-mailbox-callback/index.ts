import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/User.Read',
].join(' ');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });

  try {
    const clientId = Deno.env.get('MS_CLIENT_ID');
    const clientSecret = Deno.env.get('MS_CLIENT_SECRET');
    const tenant = Deno.env.get('MS_TENANT_ID') || 'organizations';
    if (!clientId || !clientSecret) {
      return json({ error: 'Microsoft app is not configured yet.' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const authedClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await authedClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const code: string | undefined = body?.code;
    const state: string | undefined = body?.state;
    const redirectUri: string | undefined = body?.redirectUri;
    if (!code || !state || !redirectUri) {
      return json({ error: 'code, state and redirectUri are required' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Validate the handshake state and that it belongs to this user.
    const { data: stateRow } = await admin
      .from('crm_mailbox_oauth_states')
      .select('user_id')
      .eq('state', state)
      .maybeSingle();
    if (!stateRow || stateRow.user_id !== userId) {
      return json({ error: 'Sign-in session expired, please try again.' }, 400);
    }
    await admin.from('crm_mailbox_oauth_states').delete().eq('state', state);

    // Exchange the authorization code for tokens.
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          scope: SCOPES,
        }),
      },
    );

    if (!tokenRes.ok) {
      return json({ error: `Token exchange failed (${tokenRes.status}).` }, 400);
    }

    const tokens = await tokenRes.json();
    const accessToken: string = tokens.access_token;
    const refreshToken: string = tokens.refresh_token;
    const expiresIn: number = tokens.expires_in ?? 3600;

    // Fetch the mailbox owner's identity.
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const me = meRes.ok ? await meRes.json() : {};
    const msEmail: string = me.mail || me.userPrincipalName || 'unknown';
    const msDisplayName: string = me.displayName || msEmail;

    await admin.from('crm_mailbox_connections').upsert(
      {
        user_id: userId,
        ms_email: msEmail,
        ms_display_name: msDisplayName,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        scope: SCOPES,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    return json({ connected: true, email: msEmail });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
