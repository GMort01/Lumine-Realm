import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isAudienceFilter(value: unknown): value is 'realm' | 'relationship' {
  return value === 'realm' || value === 'relationship';
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    console.error('Supabase function environment is incomplete.');
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const token = authorization.slice('Bearer '.length);
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);

  if (authError || !user) {
    return jsonResponse({ error: 'Invalid authentication' }, 401);
  }

  let payload: unknown = {};
  if (request.body) {
    try {
      payload = await request.json();
    } catch (error) {
      console.error('Gacha request body is invalid JSON:', error);
      return jsonResponse({ error: 'Invalid request body' }, 400);
    }
  }
  const audienceFilter = (
    typeof payload === 'object'
    && payload !== null
    && 'audienceFilter' in payload
  ) ? payload.audienceFilter : 'realm';
  if (!isAudienceFilter(audienceFilter)) {
    return jsonResponse({ error: 'Invalid audience filter' }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await userClient.rpc('spin_gacha_for_current_user', {
    p_audience_filter: audienceFilter,
  });

  if (error) {
    console.error('Gacha spin failed:', error.message);
    return jsonResponse({ error: 'Unable to spin the wheel right now' }, 400);
  }

  return jsonResponse(data, 200);
});
