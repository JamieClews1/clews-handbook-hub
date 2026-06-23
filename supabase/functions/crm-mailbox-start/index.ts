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
    const tenant = Deno.env.get('MS_TENANT_ID') || 'organizations';
    if (!clientId) {
      return json({ error: 'Microsoft app is not configured yet (missing MS_CLIENT_ID).' }, 400);
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

    const body = await req.json().catch(() => ({}));
    const redirectUri: string | undefined = body?.redirectUri;
    if (!redirectUri || typeof redirectUri !== 'string') {
      return json({ error: 'redirectUri is required' }, 400);
    }

    const nonce = crypto.randomUUID();

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    await admin.from('crm_mailbox_oauth_states').insert({
      state: nonce,
      user_id: userData.user.id,
    });

    // Best-effort cleanup of states older than 15 minutes.
    await admin
      .from('crm_mailbox_oauth_states')
      .delete()
      .lt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

    const authUrl = new URL(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    );
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_mode', 'query');
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('state', nonce);
    authUrl.searchParams.set('prompt', 'select_account');

    return json({ url: authUrl.toString() });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
