import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Security constants
const MAX_CODE_SIZE_BYTES = 10240; // 10KB max code size
const MAX_EXECUTIONS_PER_HOUR = 30; // Rate limit per user per hour
const EXECUTION_TIMEOUT_COMPILE = 10000; // 10s compile timeout
const EXECUTION_TIMEOUT_RUN = 5000; // 5s run timeout

// Suspicious patterns that could indicate abuse
const SUSPICIOUS_PATTERNS = [
  /while\s*\(\s*true\s*\)/gi,
  /for\s*\(\s*;\s*;\s*\)/gi,
  /eval\s*\(/gi,
  /exec\s*\(/gi,
  /spawn\s*\(/gi,
  /child_process/gi,
  /require\s*\(\s*['"]fs['"]\s*\)/gi,
  /require\s*\(\s*['"]net['"]\s*\)/gi,
  /import\s+.*from\s+['"]fs['"]/gi,
  /import\s+.*from\s+['"]net['"]/gi,
  /XMLHttpRequest|fetch\s*\(/gi,
  /crypto\s*\.\s*subtle/gi,
  /WebSocket/gi,
  /Worker\s*\(/gi,
];

const languageMap: Record<string, { language: string; version: string }> = {
  'javascript': { language: 'javascript', version: '18.15.0' },
  'js': { language: 'javascript', version: '18.15.0' },
  'typescript': { language: 'typescript', version: '5.0.3' },
  'ts': { language: 'typescript', version: '5.0.3' },
  'python': { language: 'python', version: '3.10.0' },
  'py': { language: 'python', version: '3.10.0' },
  'cpp': { language: 'c++', version: '10.2.0' },
  'c++': { language: 'c++', version: '10.2.0' },
  'c': { language: 'c', version: '10.2.0' },
  'java': { language: 'java', version: '15.0.2' },
  'go': { language: 'go', version: '1.16.2' },
  'rust': { language: 'rust', version: '1.68.2' },
  'rs': { language: 'rust', version: '1.68.2' },
  'ruby': { language: 'ruby', version: '3.0.1' },
  'rb': { language: 'ruby', version: '3.0.1' },
  'php': { language: 'php', version: '8.2.3' },
  'csharp': { language: 'csharp', version: '6.12.0' },
  'cs': { language: 'csharp', version: '6.12.0' },
  'swift': { language: 'swift', version: '5.3.3' },
  'kotlin': { language: 'kotlin', version: '1.8.20' },
  'kt': { language: 'kotlin', version: '1.8.20' },
  'bash': { language: 'bash', version: '5.2.0' },
  'sh': { language: 'bash', version: '5.2.0' },
};

async function checkRateLimit(
  serviceClient: ReturnType<typeof createClient>,
  userId: string
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await serviceClient
    .from('run_code_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('executed_at', oneHourAgo);

  if (error) {
    console.error('rate-limit count error', error);
    // Fail closed to be safe.
    return { allowed: false, remaining: 0, resetIn: 3600 };
  }

  const used = count ?? 0;
  if (used >= MAX_EXECUTIONS_PER_HOUR) {
    return { allowed: false, remaining: 0, resetIn: 3600 };
  }

  const { error: insErr } = await serviceClient
    .from('run_code_log')
    .insert({ user_id: userId });
  if (insErr) {
    console.error('rate-limit insert error', insErr);
  }

  return { allowed: true, remaining: MAX_EXECUTIONS_PER_HOUR - used - 1, resetIn: 3600 };
}

function validateCode(code: string): { valid: boolean; error?: string } {
  const codeBytes = new TextEncoder().encode(code).length;
  if (codeBytes > MAX_CODE_SIZE_BYTES) {
    return { valid: false, error: `Code exceeds maximum size of ${MAX_CODE_SIZE_BYTES / 1024}KB` };
  }
  if (!code || code.trim().length === 0) {
    return { valid: false, error: 'Code cannot be empty' };
  }
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(code)) {
      pattern.lastIndex = 0;
      return { valid: false, error: 'Code contains potentially dangerous patterns that are not allowed for security reasons' };
    }
  }
  return { valid: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Cryptographically verify the JWT via Supabase Auth instead of decoding the
    // payload manually with atob(). This prevents impersonation if verify_jwt is
    // ever disabled at the gateway and ensures the rate-limit identity cannot be
    // spoofed by the caller.
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return new Response(
        JSON.stringify({ output: '', error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.error('JWT verification failed');
      return new Response(
        JSON.stringify({ output: '', error: 'Invalid or expired authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const userId = userData.user.id;

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const rateLimit = await checkRateLimit(serviceClient, userId);
    if (!rateLimit.allowed) {
      console.warn(`Rate limit exceeded for user ${userId}`);
      return new Response(
        JSON.stringify({
          output: '',
          error: `Rate limit exceeded. You can execute ${MAX_EXECUTIONS_PER_HOUR} code snippets per hour. Try again in ${rateLimit.resetIn} seconds.`
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetIn.toString()
          }
        }
      );
    }

    const { code, language } = await req.json();

    if (typeof code !== 'string') {
      return new Response(
        JSON.stringify({ output: '', error: 'Invalid code: must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (typeof language !== 'string') {
      return new Response(
        JSON.stringify({ output: '', error: 'Invalid language: must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = validateCode(code);
    if (!validation.valid) {
      console.warn(`Code validation failed for user ${userId}: ${validation.error}`);
      return new Response(
        JSON.stringify({ output: '', error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${userId} executing ${language} code (${new TextEncoder().encode(code).length} bytes)`);

    const langConfig = languageMap[language.toLowerCase()];
    if (!langConfig) {
      return new Response(
        JSON.stringify({
          output: '',
          error: `Language '${language}' is not supported. Supported languages: ${Object.keys(languageMap).join(', ')}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pistonResponse = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: langConfig.language,
        version: langConfig.version,
        files: [{ name: getFileName(langConfig.language), content: code }],
        stdin: '',
        args: [],
        compile_timeout: EXECUTION_TIMEOUT_COMPILE,
        run_timeout: EXECUTION_TIMEOUT_RUN,
        compile_memory_limit: 128000000,
        run_memory_limit: 64000000,
      }),
    });

    if (!pistonResponse.ok) {
      const errorText = await pistonResponse.text();
      console.error(`Piston API error for user ${userId}:`, errorText);
      throw new Error(`Code execution service error: ${pistonResponse.status}`);
    }

    const result = await pistonResponse.json();

    let output = '';
    let error = '';
    if (result.compile && result.compile.code !== 0) {
      error = result.compile.stderr || result.compile.output || 'Compilation failed';
    } else if (result.run) {
      output = result.run.stdout || '';
      error = result.run.stderr || '';
      if (result.run.code !== 0 && !error) {
        error = `Process exited with code ${result.run.code}`;
      }
    }

    const MAX_OUTPUT_LENGTH = 50000;
    if (output.length > MAX_OUTPUT_LENGTH) {
      output = output.substring(0, MAX_OUTPUT_LENGTH) + '\n\n[Output truncated - exceeded 50KB limit]';
    }
    if (error.length > MAX_OUTPUT_LENGTH) {
      error = error.substring(0, MAX_OUTPUT_LENGTH) + '\n\n[Error output truncated - exceeded 50KB limit]';
    }

    return new Response(
      JSON.stringify({ output: output.trim(), error: error.trim() }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetIn.toString()
        }
      }
    );
  } catch (err) {
    console.error('Error in run-code function:', err);
    return new Response(
      JSON.stringify({ output: '', error: err instanceof Error ? err.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getFileName(language: string): string {
  const fileNames: Record<string, string> = {
    'javascript': 'main.js',
    'typescript': 'main.ts',
    'python': 'main.py',
    'c++': 'main.cpp',
    'c': 'main.c',
    'java': 'Main.java',
    'go': 'main.go',
    'rust': 'main.rs',
    'ruby': 'main.rb',
    'php': 'main.php',
    'csharp': 'Main.cs',
    'swift': 'main.swift',
    'kotlin': 'Main.kt',
    'bash': 'main.sh',
  };
  return fileNames[language] || 'main.txt';
}
