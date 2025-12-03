import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CodeEditorProps {
  fileUrl: string;
  fileName: string;
  language: string;
}

const getLanguageFromExtension = (ext: string): string => {
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust',
    'rb': 'ruby',
    'php': 'php',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'sql': 'sql',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'ps1': 'powershell',
    'r': 'r',
    'lua': 'lua',
    'perl': 'perl',
    'dart': 'dart',
    'vue': 'vue',
    'svelte': 'svelte',
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'md': 'markdown',
    'markdown': 'markdown',
    'txt': 'text',
    'ini': 'ini',
    'conf': 'conf',
    'env': 'env',
    'log': 'log',
  };
  return languageMap[ext.toLowerCase()] || ext;
};

export const CodeEditor = ({ fileUrl, fileName, language }: CodeEditorProps) => {
  const [code, setCode] = useState<string>('');
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  const resolvedLanguage = getLanguageFromExtension(language);

  useEffect(() => {
    fetch(fileUrl)
      .then(res => res.text())
      .then(text => {
        setCode(text);
        setLoading(false);
      })
      .catch(err => {
        toast.error('Failed to load code');
        setLoading(false);
      });
  }, [fileUrl]);

  const runCode = async () => {
    setIsRunning(true);
    setOutput('Running...');

    try {
      const { data, error } = await supabase.functions.invoke('run-code', {
        body: { code, language: resolvedLanguage }
      });

      if (error) throw error;
      setOutput(data.output || data.error || 'No output');
    } catch (error) {
      setOutput(`Error: ${error instanceof Error ? error.message : 'Failed to run code'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const canRun = ['python', 'javascript', 'typescript', 'js', 'ts', 'py', 'java', 'cpp', 'c'].includes(resolvedLanguage);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Language: {resolvedLanguage.toUpperCase()}
        </span>
        <div className="flex gap-2">
          {canRun && (
            <Button onClick={runCode} disabled={isRunning} size="sm">
              {isRunning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Run Code
            </Button>
          )}
        </div>
      </div>
      
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="flex-1 min-h-[300px] p-4 bg-muted rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        spellCheck={false}
      />
      
      {canRun && output && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-2">Output:</h4>
          <pre className="p-4 bg-muted rounded-lg overflow-auto max-h-48 text-sm whitespace-pre-wrap">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
};
