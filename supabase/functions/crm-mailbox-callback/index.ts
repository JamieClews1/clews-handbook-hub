import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/User.Read',
].join(' ');

function b64urlDecode(s: string) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return decodeURIComponent(escape(atob(s)));
}

function redirect(to: string, params: Record<string, string>) {
  let target = to;
  try {
    const url = new URL(to);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    target = url.toString();
  } catch {
    target = to;
  }
  return new Response(null, { status: 302, headers: { Location: target } });
}

Deno.serve(async (req) => {
  const reqUrl = new URL(req.url);
  const code = reqUrl.searchParams.get('code');
  const state = reqUrl.searchParams.get('state') || '';
  const oauthError = reqUrl.searchParams.get('error');
  const oauthErrorDesc = reqUrl.searchParams.get('error_description');

  // Decode return destination from state (nonce.<b64url(returnTo)>).
  const [nonce, returnB64] = state.split('.');
  let returnTo = '';
  try {
    returnTo = returnB64 ? b64urlDecode(returnB64) : '';
  } catch {
    returnTo = '';
  }
  const fallback = returnTo || 'https://portal.clewsrecycling.co.uk/crm';

  try {
    if (oauthError) {
      return redirect(fallback, {
        mailbox: 'error',
        reason: oauthErrorDesc || oauthError,
      });
    }
    if (!code || !nonce) {
      return redirect(fallback, { mailbox: 'error', reason: 'Missing authorization code.' });
    }

    const clientId = Deno.env.get('MS_CLIENT_ID');
    const clientSecret = Deno.env.get('MS_CLIENT_SECRET');
    const tenant = Deno.env.get('MS_TENANT_ID') || 'organizations';
    if (!clientId || !clientSecret) {
      return redirect(fallback, { mailbox: 'error', reason: 'Microsoft app not configured.' });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Look up and consume the handshake state.
    const { data: stateRow } = await admin
      .from('crm_mailbox_oauth_states')
      .select('user_id')
      .eq('state', nonce)
      .maybeSingle();
    if (!stateRow) {
      return redirect(fallback, { mailbox: 'error', reason: 'Sign-in link expired, please retry.' });
    }
    await admin.from('crm_mailbox_oauth_states').delete().eq('state', nonce);

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/crm-mailbox-callback`;

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
      const text = await tokenRes.text();
      return redirect(fallback, {
        mailbox: 'error',
        reason: `Token exchange failed (${tokenRes.status}).`,
      });
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
    const msEmail: string =
      me.mail || me.userPrincipalName || 'unknown';
    const msDisplayName: string = me.displayName || msEmail;

    await admin.from('crm_mailbox_connections').upsert(
      {
        user_id: stateRow.user_id,
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

    return redirect(fallback, { mailbox: 'connected', email: msEmail });
  } catch (e) {
    return redirect(fallback, { mailbox: 'error', reason: String(e) });
  }
});
