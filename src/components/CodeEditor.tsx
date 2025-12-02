import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CodeEditorProps {
  fileUrl: string;
  fileName: string;
  language: string;
}

export const CodeEditor = ({ fileUrl, fileName, language }: CodeEditorProps) => {
  const [code, setCode] = useState<string>('');
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);

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
        body: { code, language }
      });

      if (error) throw error;
      setOutput(data.output || data.error || 'No output');
    } catch (error) {
      setOutput(`Error: ${error instanceof Error ? error.message : 'Failed to run code'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const canRun = ['python', 'javascript', 'typescript', 'js', 'ts', 'py', 'java', 'cpp', 'c'].includes(language);

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Language: {language.toUpperCase()}</span>
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
