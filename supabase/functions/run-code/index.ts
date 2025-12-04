import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Language mapping for Piston API
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, language } = await req.json();
    
    console.log(`Executing ${language} code...`);

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

    // Call Piston API for code execution
    const pistonResponse = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language: langConfig.language,
        version: langConfig.version,
        files: [
          {
            name: getFileName(langConfig.language),
            content: code,
          }
        ],
        stdin: '',
        args: [],
        compile_timeout: 10000,
        run_timeout: 5000,
        compile_memory_limit: -1,
        run_memory_limit: -1,
      }),
    });

    if (!pistonResponse.ok) {
      const errorText = await pistonResponse.text();
      console.error('Piston API error:', errorText);
      throw new Error(`Code execution service error: ${pistonResponse.status}`);
    }

    const result = await pistonResponse.json();
    console.log('Piston response:', JSON.stringify(result));

    let output = '';
    let error = '';

    // Handle compile errors
    if (result.compile && result.compile.code !== 0) {
      error = result.compile.stderr || result.compile.output || 'Compilation failed';
    } else if (result.run) {
      // Handle runtime output
      output = result.run.stdout || '';
      error = result.run.stderr || '';
      
      if (result.run.code !== 0 && !error) {
        error = `Process exited with code ${result.run.code}`;
      }
    }

    return new Response(
      JSON.stringify({ output: output.trim(), error: error.trim() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error in run-code function:', err);
    return new Response(
      JSON.stringify({ 
        output: '', 
        error: err instanceof Error ? err.message : 'Unknown error occurred' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
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
