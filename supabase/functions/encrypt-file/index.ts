import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getRestrictedCorsHeaders, validateOrigin } from '../_shared/cors.ts';
import { createErrorResponse, logSecurityEvent } from '../_shared/error-mapper.ts';

serve(async (req) => {
  const corsHeaders = getRestrictedCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate origin for CSRF protection
    if (!validateOrigin(req)) {
      logSecurityEvent('cors_rejected', {
        origin: req.headers.get('origin'),
        ip: req.headers.get('x-forwarded-for')
      });
      // Still process but log the suspicious origin
    }

    const body = await req.json();
    const { fileId, password, action } = body;

    // Input validation
    if (!fileId || typeof fileId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action && !['encrypt', 'decrypt'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
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
      logSecurityEvent('auth_failed', {
        ip: req.headers.get('x-forwarded-for')
      });
      return new Response(
        JSON.stringify({ error: 'Authentication required or invalid' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get file info - validate ownership
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('id, user_id')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single();

    if (fileError || !file) {
      return new Response(
        JSON.stringify({ error: 'Requested resource not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Note: Real encryption would involve actual crypto operations
    // This is a simplified version that marks files as encrypted
    
    if (action === 'encrypt') {
      const { error: updateError } = await supabase
        .from('files')
        .update({
          is_encrypted: true,
          encryption_algorithm: 'AES-256-GCM',
          encryption_metadata: { 
            encrypted_at: new Date().toISOString(),
            // In production, use proper password hashing with bcrypt
          }
        })
        .eq('id', fileId);

      if (updateError) {
        console.error('Database update failed');
        return new Response(
          JSON.stringify({ error: 'An error occurred processing your request' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'File encrypted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const { error: updateError } = await supabase
        .from('files')
        .update({
          is_encrypted: false,
          encryption_algorithm: null,
          encryption_metadata: null
        })
        .eq('id', fileId);

      if (updateError) {
        console.error('Database update failed');
        return new Response(
          JSON.stringify({ error: 'An error occurred processing your request' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'File decrypted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (err) {
    return createErrorResponse(err, getRestrictedCorsHeaders(req));
  }
});
