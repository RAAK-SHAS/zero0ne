import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw';
  source: string[];
  outputs?: any[];
  execution_count?: number | null;
}

interface NotebookData {
  cells: NotebookCell[];
  metadata?: any;
}

interface NotebookViewerProps {
  fileUrl: string;
}

export const NotebookViewer = ({ fileUrl }: NotebookViewerProps) => {
  const [notebook, setNotebook] = useState<NotebookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(fileUrl)
      .then(res => res.json())
      .then(data => {
        setNotebook(data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load notebook');
        setLoading(false);
      });
  }, [fileUrl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !notebook) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        {error || 'Unable to load notebook'}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 max-h-[70vh] overflow-auto">
      {notebook.cells.map((cell, index) => (
        <div key={index} className="border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1 bg-muted text-xs">
            <span className={`px-2 py-0.5 rounded ${
              cell.cell_type === 'code' 
                ? 'bg-primary/20 text-primary' 
                : 'bg-secondary text-secondary-foreground'
            }`}>
              {cell.cell_type}
            </span>
            {cell.cell_type === 'code' && cell.execution_count !== null && (
              <span className="text-muted-foreground">
                In [{cell.execution_count ?? ' '}]
              </span>
            )}
          </div>
          
          <div className="p-3">
            {cell.cell_type === 'code' ? (
              <pre className="bg-muted/50 p-3 rounded text-sm overflow-x-auto font-mono">
                {Array.isArray(cell.source) ? cell.source.join('') : cell.source}
              </pre>
            ) : cell.cell_type === 'markdown' ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm">
                  {Array.isArray(cell.source) ? cell.source.join('') : cell.source}
                </pre>
              </div>
            ) : (
              <pre className="text-sm whitespace-pre-wrap">
                {Array.isArray(cell.source) ? cell.source.join('') : cell.source}
              </pre>
            )}
          </div>

          {cell.outputs && cell.outputs.length > 0 && (
            <div className="border-t bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground mb-2">Output:</div>
              {cell.outputs.map((output, outIndex) => (
                <div key={outIndex} className="text-sm">
                  {output.text && (
                    <pre className="whitespace-pre-wrap font-mono">
                      {Array.isArray(output.text) ? output.text.join('') : output.text}
                    </pre>
                  )}
                  {output.data && output.data['text/plain'] && (
                    <pre className="whitespace-pre-wrap font-mono">
                      {Array.isArray(output.data['text/plain']) 
                        ? output.data['text/plain'].join('') 
                        : output.data['text/plain']}
                    </pre>
                  )}
                  {output.data && output.data['image/png'] && (
                    <img 
                      src={`data:image/png;base64,${output.data['image/png']}`} 
                      alt="Output" 
                      className="max-w-full"
                    />
                  )}
                  {output.ename && (
                    <div className="text-destructive">
                      <strong>{output.ename}:</strong> {output.evalue}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
