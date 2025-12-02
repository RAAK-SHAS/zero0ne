import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, language } = await req.json();

    let output = '';
    let error = '';

    // Simple code execution for supported languages
    if (language === 'javascript' || language === 'js') {
      try {
        // Basic JS execution in a sandbox
        const result = eval(code);
        output = String(result);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    } else if (language === 'typescript' || language === 'ts') {
      output = 'TypeScript execution requires compilation. Use JavaScript for now.';
    } else if (language === 'python' || language === 'py') {
      output = 'Python execution not supported in this environment yet.';
    } else {
      output = `Code execution for ${language} is not yet supported.`;
    }

    return new Response(
      JSON.stringify({ output, error }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('Error in run-code function:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
