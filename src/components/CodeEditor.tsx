import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Loader2, Terminal, Code2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Editor from '@monaco-editor/react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CodeEditorProps {
  fileUrl: string;
  fileName: string;
  language: string;
}

const getMonacoLanguage = (ext: string): string => {
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
    'sass': 'scss',
    'less': 'less',
    'sql': 'sql',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'ps1': 'powershell',
    'r': 'r',
    'lua': 'lua',
    'perl': 'perl',
    'dart': 'dart',
    'vue': 'html',
    'svelte': 'html',
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'md': 'markdown',
    'markdown': 'markdown',
    'txt': 'plaintext',
    'ini': 'ini',
    'conf': 'ini',
    'env': 'plaintext',
    'log': 'plaintext',
  };
  return languageMap[ext.toLowerCase()] || 'plaintext';
};

const getExecutableLanguage = (ext: string): string => {
  const execMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'go': 'go',
    'rs': 'rust',
    'rb': 'ruby',
    'php': 'php',
    'cs': 'csharp',
    'swift': 'swift',
    'kt': 'kotlin',
    'sh': 'bash',
    'bash': 'bash',
  };
  return execMap[ext.toLowerCase()] || '';
};

const getLanguageDisplayName = (ext: string): string => {
  const nameMap: Record<string, string> = {
    'js': 'JavaScript',
    'jsx': 'JavaScript (JSX)',
    'ts': 'TypeScript',
    'tsx': 'TypeScript (TSX)',
    'py': 'Python',
    'java': 'Java',
    'cpp': 'C++',
    'c': 'C',
    'go': 'Go',
    'rs': 'Rust',
    'rb': 'Ruby',
    'php': 'PHP',
    'cs': 'C#',
    'swift': 'Swift',
    'kt': 'Kotlin',
    'sh': 'Bash',
    'bash': 'Bash',
    'html': 'HTML',
    'css': 'CSS',
    'json': 'JSON',
    'xml': 'XML',
    'yaml': 'YAML',
    'yml': 'YAML',
    'md': 'Markdown',
    'sql': 'SQL',
  };
  return nameMap[ext.toLowerCase()] || ext.toUpperCase();
};

export const CodeEditor = ({ fileUrl, fileName, language }: CodeEditorProps) => {
  const [code, setCode] = useState<string>('');
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  const monacoLanguage = getMonacoLanguage(language);
  const execLanguage = getExecutableLanguage(language);
  const displayName = getLanguageDisplayName(language);

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
    setOutput('');
    setError('');
    setExecutionTime(null);

    const startTime = Date.now();

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('run-code', {
        body: { code, language: execLanguage }
      });

      const endTime = Date.now();
      setExecutionTime(endTime - startTime);

      if (invokeError) throw invokeError;
      
      if (data.output) {
        setOutput(data.output);
      }
      if (data.error) {
        setError(data.error);
      }
      if (!data.output && !data.error) {
        setOutput('Program executed successfully (no output)');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run code');
    } finally {
      setIsRunning(false);
    }
  };

  const canRun = execLanguage !== '';

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <Code2 className="h-5 w-5 text-primary" />
          <span className="font-medium text-foreground">{fileName}</span>
          <Badge variant="secondary" className="text-xs">
            {displayName}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {canRun && (
            <Button 
              onClick={runCode} 
              disabled={isRunning} 
              size="sm"
              className="gap-2"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isRunning ? 'Running...' : 'Run Code'}
            </Button>
          )}
        </div>
      </div>
      
      {/* Editor */}
      <Card className="flex-1 min-h-[300px] overflow-hidden border-border">
        <Editor
          height="100%"
          language={monacoLanguage}
          value={code}
          onChange={(value) => setCode(value || '')}
          theme="vs-dark"
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            folding: true,
            foldingHighlight: true,
            bracketPairColorization: { enabled: true },
            padding: { top: 16, bottom: 16 },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            renderLineHighlight: 'all',
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            fontLigatures: true,
          }}
        />
      </Card>
      
      {/* Output Panel */}
      {canRun && (output || error || isRunning) && (
        <Card className="border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Output</span>
            </div>
            <div className="flex items-center gap-2">
              {executionTime !== null && (
                <span className="text-xs text-muted-foreground">
                  {executionTime}ms
                </span>
              )}
              {output && !error && (
                <Badge variant="outline" className="gap-1 text-green-600 border-green-600/30 bg-green-600/10">
                  <CheckCircle2 className="h-3 w-3" />
                  Success
                </Badge>
              )}
              {error && (
                <Badge variant="outline" className="gap-1 text-destructive border-destructive/30 bg-destructive/10">
                  <XCircle className="h-3 w-3" />
                  Error
                </Badge>
              )}
            </div>
          </div>
          <ScrollArea className="h-[200px]">
            <div className="p-4 font-mono text-sm">
              {isRunning ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Executing code...
                </div>
              ) : (
                <>
                  {output && (
                    <pre className="whitespace-pre-wrap text-foreground">{output}</pre>
                  )}
                  {error && (
                    <pre className="whitespace-pre-wrap text-destructive">{error}</pre>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </Card>
      )}

      {/* Supported Languages Info */}
      {!canRun && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          This file type is view-only. Runnable languages: JavaScript, TypeScript, Python, C, C++, Java, Go, Rust, Ruby, PHP, C#, Swift, Kotlin, Bash
        </div>
      )}
    </div>
  );
};
