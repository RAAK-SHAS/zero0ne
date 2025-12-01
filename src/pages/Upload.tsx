import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';
import { Upload as UploadIcon, Cloud, ArrowLeft, File } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks

const Upload = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    disabled: uploading
  });

  const uploadFile = async () => {
    if (!selectedFile || !user) return;

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

      if (profile.storage_used_bytes + selectedFile.size > profile.storage_quota_bytes) {
        throw new Error('Storage quota exceeded');
      }

      // Upload file to storage
      const fileName = `${user.id}/${Date.now()}-${selectedFile.name}`;
      
      // Simulate upload progress for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const { error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(fileName, selectedFile);

      clearInterval(progressInterval);
      setProgress(100);

      if (uploadError) throw uploadError;

      // Create file record in database
      const { error: dbError } = await supabase
        .from('files')
        .insert({
          user_id: user.id,
          name: selectedFile.name,
          size_bytes: selectedFile.size,
          mime_type: selectedFile.type,
          storage_path: fileName
        });

      if (dbError) throw dbError;

      toast.success('File uploaded successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/20">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <Cloud className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Upload File</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input {...getInputProps()} />
            <UploadIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            {selectedFile ? (
              <div className="space-y-2">
                <File className="h-8 w-8 mx-auto text-primary" />
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <>
                <p className="text-lg font-medium mb-2">
                  {isDragActive ? 'Drop file here' : 'Drag & drop file here'}
                </p>
                <p className="text-sm text-muted-foreground">or click to browse</p>
              </>
            )}
          </div>

          {uploading && (
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {selectedFile && !uploading && (
            <div className="mt-6 flex gap-4">
              <Button
                onClick={() => setSelectedFile(null)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={uploadFile} className="flex-1">
                Upload File
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Upload;