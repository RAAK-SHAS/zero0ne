import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0'
import { wildcardCorsHeaders } from '../_shared/cors.ts';
import { createErrorResponse, logSecurityEvent } from '../_shared/error-mapper.ts';
import { verifyPassword, isLegacySha256Hash, verifyLegacySha256 } from '../_shared/password-hash.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: wildcardCorsHeaders });
  }

  try {
    const { token, password } = await req.json();

    if (!token || typeof token !== 'string' || token.length < 10 || token.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Invalid share token format' }),
        { status: 400, headers: { ...wildcardCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client for privileged access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log(`Validating share token`);

    // Validate the share token and get file info
    const { data: share, error: shareError } = await supabaseAdmin
      .from('shares')
      .select('file_id, expires_at, password_hash')
      .eq('token', token)
      .single();

    if (shareError || !share) {
      logSecurityEvent('share_access_failed', {
        reason: 'invalid_token',
        ip: req.headers.get('x-forwarded-for')
      });
      return new Response(
        JSON.stringify({ error: 'Invalid or expired share link' }),
        { status: 404, headers: { ...wildcardCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if share has expired
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      logSecurityEvent('share_access_failed', {
        reason: 'expired',
        ip: req.headers.get('x-forwarded-for')
      });
      return new Response(
        JSON.stringify({ error: 'Share link has expired' }),
        { status: 403, headers: { ...wildcardCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check password if required
    if (share.password_hash) {
      if (!password || typeof password !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Password required', passwordRequired: true }),
          { status: 401, headers: { ...wildcardCorsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify password - support both bcrypt and legacy SHA-256
      let isValidPassword = false;
      
      if (isLegacySha256Hash(share.password_hash)) {
        // Legacy SHA-256 verification for backwards compatibility
        isValidPassword = await verifyLegacySha256(password, share.password_hash);
      } else {
        // Modern bcrypt verification
        isValidPassword = await verifyPassword(password, share.password_hash);
      }

      if (!isValidPassword) {
        logSecurityEvent('share_password_failed', {
          ip: req.headers.get('x-forwarded-for')
        });
        return new Response(
          JSON.stringify({ error: 'Incorrect password', passwordRequired: true }),
          { status: 401, headers: { ...wildcardCorsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get file details
    const { data: file, error: fileError } = await supabaseAdmin
      .from('files')
      .select('id, name, size_bytes, mime_type, storage_path, created_at')
      .eq('id', share.file_id)
      .single();

    if (fileError || !file) {
      return new Response(
        JSON.stringify({ error: 'File not found' }),
        { status: 404, headers: { ...wildcardCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a signed URL using service role (60 second expiry)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('user-files')
      .createSignedUrl(file.storage_path, 60);

    if (signedUrlError || !signedUrlData) {
      console.error('Failed to create signed URL');
      return new Response(
        JSON.stringify({ error: 'Failed to generate download link' }),
        { status: 500, headers: { ...wildcardCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully generated signed URL for shared file`);

    return new Response(
      JSON.stringify({
        file: {
          id: file.id,
          name: file.name,
          size_bytes: file.size_bytes,
          mime_type: file.mime_type,
          created_at: file.created_at
        },
        signedUrl: signedUrlData.signedUrl,
        passwordRequired: !!share.password_hash
      }),
      { status: 200, headers: { ...wildcardCorsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return createErrorResponse(error, wildcardCorsHeaders);
  }
});
