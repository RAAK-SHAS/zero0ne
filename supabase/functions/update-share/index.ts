import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getRestrictedCorsHeaders } from '../_shared/cors.ts';
import { createErrorResponse } from '../_shared/error-mapper.ts';
import { hashPassword } from '../_shared/password-hash.ts';

serve(async (req) => {
  const corsHeaders = getRestrictedCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { shareToken, password, expirationDays } = body;

    // Input validation
    if (!shareToken || typeof shareToken !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password && (typeof password !== 'string' || password.length < 4 || password.length > 128)) {
      return new Response(
        JSON.stringify({ error: 'Password must be between 4 and 128 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (expirationDays !== null && expirationDays !== undefined && 
        (typeof expirationDays !== 'number' || expirationDays < 0 || expirationDays > 365)) {
      return new Response(
        JSON.stringify({ error: 'Expiration must be between 0 and 365 days' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required or invalid' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify share belongs to user's file
    const { data: share, error: shareError } = await supabase
      .from('shares')
      .select('id, file_id, files!inner(user_id)')
      .eq('token', shareToken)
      .single();

    if (shareError || !share) {
      return new Response(
        JSON.stringify({ error: 'Share not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build updates
    const updates: Record<string, unknown> = {};
    
    if (expirationDays !== undefined) {
      if (expirationDays !== null && expirationDays > 0) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expirationDays);
        updates.expires_at = expiresAt.toISOString();
      } else {
        updates.expires_at = null;
      }
    }

    if (password !== undefined) {
      if (password) {
        // Use bcrypt for secure password hashing
        updates.password_hash = await hashPassword(password);
      } else {
        updates.password_hash = null;
      }
    }

    const { error: updateError } = await supabase
      .from('shares')
      .update(updates)
      .eq('token', shareToken);

    if (updateError) {
      console.error('Failed to update share');
      return new Response(
        JSON.stringify({ error: 'An error occurred processing your request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return createErrorResponse(err, getRestrictedCorsHeaders(req));
  }
});
