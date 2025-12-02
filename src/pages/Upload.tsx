import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';
import { Upload as UploadIcon, ArrowLeft, X, FileIcon } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { formatBytes } from '@/lib/utils';

const Upload = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    disabled: uploading
  });

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0 || !user) return;

    setUploading(true);
    setProgress(0);

    try {
      // Check quota first
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('storage_used_bytes, storage_quota_bytes')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);

      if (profile.storage_used_bytes + totalSize > profile.storage_quota_bytes) {
        throw new Error('Storage quota exceeded');
      }

      // Upload each file
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileName = `${user.id}/${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('user-files')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from('files')
          .insert({
            user_id: user.id,
            name: file.name,
            size_bytes: file.size,
            mime_type: file.type,
            storage_path: fileName
          });

        if (dbError) throw dbError;

        setProgress(((i + 1) / selectedFiles.length) * 100);
      }

      toast.success(`${selectedFiles.length} file(s) uploaded successfully!`);
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload files');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/20">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold text-center">Upload Files</h1>

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
                <h3 className="font-semibold">Selected Files ({selectedFiles.length})</h3>
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

              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              <Button onClick={uploadFiles} disabled={uploading} className="w-full" size="lg">
                {uploading ? (
                  <>Uploading {Math.round(progress)}%</>
                ) : (
                  <>
                    <UploadIcon className="h-5 w-5 mr-2" />
                    Upload {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Upload;