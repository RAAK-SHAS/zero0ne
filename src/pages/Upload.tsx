import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUploadManager } from '@/contexts/UploadContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { GlobalUploadIndicator } from '@/components/GlobalUploadIndicator';
import { toast } from 'sonner';
import { Upload as UploadIcon, ArrowLeft, X, FileIcon, FolderUp, Zap, Pause } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { formatBytes } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const Upload = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  const { addFiles, uploads, getPendingCount } = useUploadManager();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  });

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
      toast.success(`Added ${files.length} files from folder`);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !user) return;

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('storage_used_bytes, storage_quota_bytes')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);

      if (profile.storage_used_bytes + totalSize > profile.storage_quota_bytes) {
        toast.error('Storage quota exceeded');
        return;
      }

      addFiles(selectedFiles, user.id);
      toast.success(`Added ${selectedFiles.length} file(s) to upload queue`);
      setSelectedFiles([]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to start uploads');
    }
  };

  const pendingCount = getPendingCount();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/20">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <GlobalUploadIndicator />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Upload Files</h1>
            <p className="text-muted-foreground">
              Resumable uploads • Pause & resume anytime • Up to 100TB
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Zap className="h-4 w-4 text-primary" />
                Queue management
              </span>
              <span className="flex items-center gap-1">
                <Pause className="h-4 w-4 text-yellow-500" />
                Resume across sessions
              </span>
            </div>
          </div>

          <div className="flex gap-2 justify-center">
            <input
              ref={folderInputRef}
              type="file"
              // @ts-ignore - webkitdirectory is not in types
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={handleFolderSelect}
            />
            <Button variant="outline" onClick={() => folderInputRef.current?.click()}>
              <FolderUp className="h-4 w-4 mr-2" />
              Upload Folder
            </Button>
          </div>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
              isDragActive
                ? 'border-primary bg-primary/10'
                : 'border-muted-foreground/25 hover:border-primary'
            }`}
          >
            <input {...getInputProps()} />
            <UploadIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-lg font-medium">Drop files here...</p>
            ) : (
              <>
                <p className="text-lg font-medium mb-2">Drag & drop files here</p>
                <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
                <Button variant="outline">Select Files</Button>
              </>
            )}
          </div>

          {selectedFiles.length > 0 && (
            <div className="bg-card rounded-lg p-6 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  Ready to Upload ({selectedFiles.length}) - {formatBytes(selectedFiles.reduce((sum, f) => sum + f.size, 0))}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedFiles([])}>
                  Clear All
                </Button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileIcon className="h-5 w-5 text-primary flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{file.name}</p>
                        <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeFile(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button onClick={handleUpload} className="w-full" size="lg">
                <UploadIcon className="h-5 w-5 mr-2" />
                Upload {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
              </Button>
            </div>
          )}

          {pendingCount > 0 && selectedFiles.length === 0 && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
              <p className="text-sm">
                {pendingCount} upload(s) in progress. Check the upload indicator in the header.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Upload;
