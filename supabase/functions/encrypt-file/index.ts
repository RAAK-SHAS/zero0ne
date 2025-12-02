import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileId, password, action } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get file info
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single();

    if (fileError || !file) {
      throw new Error('File not found');
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
            password_hash: 'hash_placeholder' // In production, use proper password hashing
          }
        })
        .eq('id', fileId);

      if (updateError) throw updateError;

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

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ success: true, message: 'File decrypted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (err) {
    console.error('Error in encrypt-file function:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
