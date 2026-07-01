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
      // Brute-force protection: count failed attempts in the last 15 minutes
      const tokenHashBuf = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(token)
      );
      const tokenHash = Array.from(new Uint8Array(tokenHashBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
      const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count: recentFailures } = await supabaseAdmin
        .from('share_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('token_hash', tokenHash)
        .eq('succeeded', false)
        .gte('attempted_at', windowStart);

      const MAX_FAILED_ATTEMPTS = 10;
      if ((recentFailures ?? 0) >= MAX_FAILED_ATTEMPTS) {
        logSecurityEvent('share_password_locked', { ip, tokenHash });
        return new Response(
          JSON.stringify({ error: 'Too many failed attempts. Please try again later.' }),
          {
            status: 429,
            headers: {
              ...wildcardCorsHeaders,
              'Content-Type': 'application/json',
              'Retry-After': '900',
            },
          }
        );
      }

      if (!password || typeof password !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Password required', passwordRequired: true }),
          { status: 401, headers: { ...wildcardCorsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let isValidPassword = false;
      if (isLegacySha256Hash(share.password_hash)) {
        isValidPassword = await verifyLegacySha256(password, share.password_hash);
      } else {
        isValidPassword = await verifyPassword(password, share.password_hash);
      }

      // Record the attempt (success or failure) for rate-limiting/audit
      await supabaseAdmin.from('share_attempts').insert({
        token_hash: tokenHash,
        ip_address: ip,
        succeeded: isValidPassword,
      });

      if (!isValidPassword) {
        // Small artificial delay to slow automated guessing
        await new Promise((r) => setTimeout(r, 250));
        logSecurityEvent('share_password_failed', { ip });
        return new Response(
          JSON.stringify({ error: 'Incorrect password', passwordRequired: true }),
          { status: 401, headers: { ...wildcardCorsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get file details
    const { data: file, error: fileError } = await supabaseAdmin
      .from('files')
      .select('id, name, size_bytes, mime_type, storage_path, created_at, upload_strategy, chunk_size_bytes, chunk_count, chunk_paths')
      .eq('id', share.file_id)
      .single();

    if (fileError || !file) {
      return new Response(
        JSON.stringify({ error: 'File not found' }),
        { status: 404, headers: { ...wildcardCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (file.upload_strategy === 'chunked') {
      const signedChunkPaths: string[] = [];
      for (const path of file.chunk_paths ?? []) {
        const { data: signedChunk, error: signedChunkError } = await supabaseAdmin.storage
          .from('user-files')
          .createSignedUrl(path, 300);
        if (signedChunkError || !signedChunk) {
          return new Response(
            JSON.stringify({ error: 'Failed to generate download link' }),
            { status: 500, headers: { ...wildcardCorsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        signedChunkPaths.push(signedChunk.signedUrl);
      }

      return new Response(
        JSON.stringify({
          file: {
            id: file.id,
            name: file.name,
            size_bytes: file.size_bytes,
            mime_type: file.mime_type,
            storage_path: file.storage_path,
            created_at: file.created_at,
            upload_strategy: file.upload_strategy,
            chunk_size_bytes: file.chunk_size_bytes,
            chunk_count: file.chunk_count,
            chunk_paths: signedChunkPaths,
          },
          passwordRequired: !!share.password_hash
        }),
        { status: 200, headers: { ...wildcardCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a signed URL using service role (15 minute expiry — gives slow connections time to start)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('user-files')
      .createSignedUrl(file.storage_path, 900);

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
          storage_path: file.storage_path,
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
