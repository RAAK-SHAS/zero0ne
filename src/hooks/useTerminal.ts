import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'info' | 'success' | 'system';
  content: string;
  timestamp: number;
}

interface TerminalState {
  currentPath: string[];
  currentFolderId: string | null;
}

const COMMAND_ALIASES: Record<string, string> = {
  rm: 'delete',
  ll: 'ls',
  dir: 'ls',
  cat: 'preview',
  cp: 'copy',
  mv: 'move',
  dl: 'download',
  ul: 'upload',
};

const ALL_COMMANDS = [
  'ls', 'cd', 'pwd', 'tree', 'upload', 'download', 'open', 'preview',
  'rename', 'move', 'copy', 'delete', 'trash', 'restore', 'mkdir', 'rmdir',
  'clear', 'share', 'unshare', 'link', 'find', 'search', 'type',
  'help', 'whoami', 'du', 'history', 'ai',
];

export const useTerminal = (
  userId: string | undefined,
  files: any[],
  folders: any[],
  callbacks: {
    onNavigateFolder: (folderId: string | null) => void;
    onDownload: (fileId: string) => void;
    onPreview: (fileId: string) => void;
    onShare: (fileId: string) => void;
    onDelete: (fileId: string) => void;
    onRename: (fileId: string) => void;
    onCreateFolder: (name: string) => Promise<any>;
    onDeleteFolder: (folderId: string) => void;
    onUploadClick: () => void;
    refreshData: () => void;
  }
) => {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'welcome',
      type: 'system',
      content: `╔══════════════════════════════════════════════════╗
║  CloudStore Terminal v2.0                        ║
║  Type 'help' for available commands              ║
║  Use 'ai <query>' for natural language commands   ║
╚══════════════════════════════════════════════════╝`,
      timestamp: Date.now(),
    },
  ]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const termState = useRef<TerminalState>({
    currentPath: ['/'],
    currentFolderId: null,
  });

  // Sync terminal state with dashboard folder navigation
  useEffect(() => {
    // We keep terminal state aligned but don't force navigation
  }, []);

  const addLine = useCallback((type: TerminalLine['type'], content: string) => {
    setLines(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      type,
      content,
      timestamp: Date.now(),
    }]);
  }, []);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getCurrentFolderFiles = useCallback(() => {
    return files.filter(f => {
      if (termState.current.currentFolderId) {
        return f.folder_id === termState.current.currentFolderId;
      }
      return !f.folder_id;
    });
  }, [files]);

  const getCurrentFolderSubfolders = useCallback(() => {
    return folders.filter(f => f.parent_id === termState.current.currentFolderId);
  }, [folders]);

  const resolveFileName = useCallback((name: string): any | null => {
    const currentFiles = getCurrentFolderFiles();
    // Exact match
    let match = currentFiles.find(f => f.name === name);
    if (match) return match;
    // Case-insensitive
    match = currentFiles.find(f => f.name.toLowerCase() === name.toLowerCase());
    if (match) return match;
    // Partial match
    match = currentFiles.find(f => f.name.toLowerCase().includes(name.toLowerCase()));
    return match;
  }, [getCurrentFolderFiles]);

  const resolveFolderName = useCallback((name: string): any | null => {
    const subfolders = getCurrentFolderSubfolders();
    let match = subfolders.find(f => f.name === name);
    if (match) return match;
    match = subfolders.find(f => f.name.toLowerCase() === name.toLowerCase());
    return match;
  }, [getCurrentFolderSubfolders]);

  const getPathString = useCallback((): string => {
    if (!termState.current.currentFolderId) return '/';
    
    const path: string[] = [];
    let currentId: string | null = termState.current.currentFolderId;
    
    while (currentId) {
      const folder = folders.find(f => f.id === currentId);
      if (folder) {
        path.unshift(folder.name);
        currentId = folder.parent_id;
      } else {
        break;
      }
    }
    
    return '/' + path.join('/');
  }, [folders]);

  // Internal execute that processes a single command, returns output lines
  const executeSingleCommand = useCallback(async (rawInput: string, isPiped: boolean = false, pipedInput: string[] = []): Promise<string[]> => {
    const trimmed = rawInput.trim();
    if (!trimmed) return [];

    const parts = trimmed.split(/\s+/);
    let command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Resolve aliases
    if (COMMAND_ALIASES[command]) {
      command = COMMAND_ALIASES[command];
    }

    // Collect output for piping
    const outputLines: string[] = [];
    const collectLine = (type: TerminalLine['type'], content: string) => {
      if (isPiped) {
        // Only collect output lines for piping, not info/system messages
        if (type === 'output' || type === 'success') {
          outputLines.push(content);
        }
      }
      addLine(type, content);
    };

    try {
      switch (command) {
        case 'help': {
          addLine('info', `
Available Commands:
─────────────────────────────────────────
  Navigation
    ls                    List files in current directory
    cd <folder>           Change directory (cd .. to go up)
    pwd                   Print working directory
    tree                  Show folder structure

  File Operations
    download <file>       Download a file
    open <file>           Preview/open a file
    preview <file>        Preview a file
    rename <file>         Rename a file
    delete <file>         Move file to trash
    trash <file>          Move file to trash

  Folder Operations
    mkdir <name>          Create a new folder
    rmdir <folder>        Delete a folder
    
  Sharing
    share <file>          Share a file and get link
    link <file>           Share a file and get link

  Search
    find <name>           Find files by name
    search <keyword>      Search files by keyword
    type <category>       Filter by type (image/pdf/video/audio/doc)

  Utilities
    clear                 Clear terminal
    whoami                Show current user
    du                    Show disk usage
    history               Show command history
    upload                Open upload dialog

  AI Assistant
    ai <query>            Natural language file commands
    
  Aliases: rm=delete, ll=ls, dir=ls, cp=copy, mv=move, dl=download
─────────────────────────────────────────`);
          break;
        }

        case 'clear': {
          setLines([]);
          break;
        }

        case 'pwd': {
          addLine('output', getPathString());
          break;
        }

        case 'whoami': {
          const { data } = await supabase.from('profiles').select('email, name').eq('id', userId!).single();
          addLine('output', `User: ${data?.name || data?.email || userId}`);
          break;
        }

        case 'du': {
          const { data } = await supabase.from('profiles').select('storage_used_bytes, storage_quota_bytes').eq('id', userId!).single();
          if (data) {
            const usedPct = ((data.storage_used_bytes / data.storage_quota_bytes) * 100).toFixed(1);
            addLine('output', `Disk Usage: ${formatSize(data.storage_used_bytes)} / ${formatSize(data.storage_quota_bytes)} (${usedPct}%)`);
          }
          break;
        }

        case 'history': {
          if (commandHistory.length === 0) {
            addLine('info', 'No command history');
          } else {
            const hist = commandHistory.slice(-20).map((cmd, i) => `  ${i + 1}  ${cmd}`).join('\n');
            addLine('output', hist);
          }
          break;
        }

        case 'ls': {
          const subfolders = getCurrentFolderSubfolders();
          const currentFiles = getCurrentFolderFiles();
          
          if (subfolders.length === 0 && currentFiles.length === 0) {
            addLine('info', 'Directory is empty');
            break;
          }

          let output = '';
          
          if (subfolders.length > 0) {
            output += subfolders.map(f => `  📁 ${f.name}/`).join('\n') + '\n';
          }
          
          if (currentFiles.length > 0) {
            const maxNameLen = Math.max(...currentFiles.map(f => f.name.length), 10);
            output += currentFiles.map(f => {
              const name = f.name.padEnd(maxNameLen + 2);
              const size = formatSize(f.size_bytes).padStart(10);
              const date = formatDate(f.created_at);
              const fav = f.is_favorite ? '★' : ' ';
              const enc = f.is_encrypted ? '🔒' : ' ';
              return `  ${fav} ${enc} ${name} ${size}  ${date}`;
            }).join('\n');
          }
          
          addLine('output', output);
          addLine('info', `${subfolders.length} folder(s), ${currentFiles.length} file(s)`);
          break;
        }

        case 'cd': {
          if (args.length === 0 || args[0] === '~' || args[0] === '/') {
            termState.current.currentFolderId = null;
            termState.current.currentPath = ['/'];
            callbacks.onNavigateFolder(null);
            addLine('success', `Changed to /`);
          } else if (args[0] === '..') {
            if (termState.current.currentFolderId) {
              const currentFolder = folders.find(f => f.id === termState.current.currentFolderId);
              termState.current.currentFolderId = currentFolder?.parent_id || null;
              callbacks.onNavigateFolder(termState.current.currentFolderId);
              addLine('success', `Changed to ${getPathString()}`);
            } else {
              addLine('info', 'Already at root directory');
            }
          } else {
            const targetFolder = resolveFolderName(args.join(' '));
            if (targetFolder) {
              termState.current.currentFolderId = targetFolder.id;
              callbacks.onNavigateFolder(targetFolder.id);
              addLine('success', `Changed to ${getPathString()}`);
            } else {
              addLine('error', `cd: no such directory: ${args.join(' ')}`);
            }
          }
          break;
        }

        case 'tree': {
          const buildTree = (parentId: string | null, prefix: string = ''): string => {
            const children = folders.filter(f => f.parent_id === parentId);
            let output = '';
            children.forEach((child, i) => {
              const isLast = i === children.length - 1;
              const connector = isLast ? '└── ' : '├── ';
              const childPrefix = isLast ? '    ' : '│   ';
              output += `${prefix}${connector}📁 ${child.name}\n`;
              output += buildTree(child.id, prefix + childPrefix);
            });
            return output;
          };
          
          let tree = '📁 /\n' + buildTree(null);
          if (tree.trim() === '📁 /') {
            addLine('info', 'No folders found');
          } else {
            addLine('output', tree);
          }
          break;
        }

        case 'mkdir': {
          if (args.length === 0) {
            addLine('error', 'Usage: mkdir <folder_name>');
            break;
          }
          const folderName = args.join(' ');
          const result = await callbacks.onCreateFolder(folderName);
          if (result) {
            addLine('success', `Created directory: ${folderName}`);
          } else {
            addLine('error', `Failed to create directory: ${folderName}`);
          }
          break;
        }

        case 'rmdir': {
          if (args.length === 0) {
            addLine('error', 'Usage: rmdir <folder_name>');
            break;
          }
          const folder = resolveFolderName(args.join(' '));
          if (folder) {
            callbacks.onDeleteFolder(folder.id);
            addLine('success', `Deleted directory: ${folder.name}`);
          } else {
            addLine('error', `rmdir: no such directory: ${args.join(' ')}`);
          }
          break;
        }

        case 'download':
        case 'dl': {
          if (args.length === 0) {
            addLine('error', 'Usage: download <filename>');
            break;
          }
          
          const pattern = args.join(' ');
          
          // Wildcard support
          if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
            const matches = getCurrentFolderFiles().filter(f => regex.test(f.name));
            if (matches.length === 0) {
              addLine('error', `No files matching: ${pattern}`);
            } else {
              addLine('info', `Downloading ${matches.length} file(s)...`);
              for (const file of matches) {
                callbacks.onDownload(file.id);
                addLine('success', `  ↓ ${file.name}`);
              }
            }
          } else {
            const file = resolveFileName(pattern);
            if (file) {
              callbacks.onDownload(file.id);
              addLine('success', `Downloading: ${file.name} (${formatSize(file.size_bytes)})`);
            } else {
              addLine('error', `File not found: ${pattern}`);
            }
          }
          break;
        }

        case 'open':
        case 'preview': {
          if (args.length === 0) {
            addLine('error', `Usage: ${command} <filename>`);
            break;
          }
          const file = resolveFileName(args.join(' '));
          if (file) {
            callbacks.onPreview(file.id);
            addLine('success', `Opening preview: ${file.name}`);
          } else {
            addLine('error', `File not found: ${args.join(' ')}`);
          }
          break;
        }

        case 'share':
        case 'link': {
          if (args.length === 0) {
            addLine('error', `Usage: ${command} <filename>`);
            break;
          }
          const file = resolveFileName(args.join(' '));
          if (file) {
            callbacks.onShare(file.id);
            addLine('success', `Creating share link for: ${file.name}`);
          } else {
            addLine('error', `File not found: ${args.join(' ')}`);
          }
          break;
        }

        case 'delete':
        case 'trash': {
          if (args.length === 0) {
            addLine('error', `Usage: ${command} <filename>`);
            break;
          }
          
          const pattern = args.join(' ');
          
          if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
            const matches = getCurrentFolderFiles().filter(f => regex.test(f.name));
            if (matches.length === 0) {
              addLine('error', `No files matching: ${pattern}`);
            } else if (matches.length > 5) {
              addLine('error', `⚠ Bulk delete blocked: ${matches.length} files matched. Use the GUI for bulk operations over 5 files.`);
            } else {
              addLine('info', `Trashing ${matches.length} file(s)...`);
              for (const file of matches) {
                callbacks.onDelete(file.id);
                addLine('success', `  🗑 ${file.name}`);
              }
            }
          } else {
            const file = resolveFileName(pattern);
            if (file) {
              callbacks.onDelete(file.id);
              addLine('success', `Moved to trash: ${file.name}`);
            } else {
              addLine('error', `File not found: ${pattern}`);
            }
          }
          break;
        }

        case 'rename': {
          if (args.length === 0) {
            addLine('error', 'Usage: rename <filename>');
            break;
          }
          const file = resolveFileName(args.join(' '));
          if (file) {
            callbacks.onRename(file.id);
            addLine('info', `Rename dialog opened for: ${file.name}`);
          } else {
            addLine('error', `File not found: ${args.join(' ')}`);
          }
          break;
        }

        case 'move': {
          if (args.length < 2) {
            addLine('error', 'Usage: move <filename> <folder>');
            break;
          }
          
          const pattern = args.slice(0, -1).join(' ');
          const targetFolderName = args[args.length - 1];
          
          let targetFolderId: string | null = null;
          if (targetFolderName === '/' || targetFolderName === '~') {
            targetFolderId = null;
          } else {
            const tf = folders.find(f => f.name.toLowerCase() === targetFolderName.toLowerCase());
            if (!tf) {
              addLine('error', `Target folder not found: ${targetFolderName}`);
              break;
            }
            targetFolderId = tf.id;
          }

          if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
            const matches = getCurrentFolderFiles().filter(f => regex.test(f.name));
            if (matches.length === 0) {
              addLine('error', `No files matching: ${pattern}`);
            } else {
              const { error } = await supabase
                .from('files')
                .update({ folder_id: targetFolderId })
                .in('id', matches.map(f => f.id));
              if (error) throw error;
              addLine('success', `Moved ${matches.length} file(s) to ${targetFolderName}`);
              callbacks.refreshData();
            }
          } else {
            const file = resolveFileName(pattern);
            if (file) {
              const { error } = await supabase
                .from('files')
                .update({ folder_id: targetFolderId })
                .eq('id', file.id);
              if (error) throw error;
              addLine('success', `Moved ${file.name} to ${targetFolderName}`);
              callbacks.refreshData();
            } else {
              addLine('error', `File not found: ${pattern}`);
            }
          }
          break;
        }

        case 'find':
        case 'search': {
          if (args.length === 0) {
            addLine('error', `Usage: ${command} <keyword>`);
            break;
          }
          const keyword = args.join(' ').toLowerCase();
          const matches = files.filter(f => f.name.toLowerCase().includes(keyword));
          if (matches.length === 0) {
            addLine('info', `No files matching: \"${args.join(' ')}\"`);
          } else {
            const output = matches.map(f => {
              const foldPath = f.folder_id ? folders.find(fo => fo.id === f.folder_id)?.name || '?' : '/';
              return `  ${f.name}  (${formatSize(f.size_bytes)})  [${foldPath}]`;
            }).join('\n');
            addLine('output', output);
            addLine('info', `Found ${matches.length} result(s)`);
          }
          break;
        }

        case 'type': {
          if (args.length === 0) {
            addLine('error', 'Usage: type <image|pdf|video|audio|doc|archive>');
            break;
          }
          const typeMap: Record<string, string[]> = {
            image: ['image/'],
            images: ['image/'],
            pdf: ['application/pdf'],
            video: ['video/'],
            videos: ['video/'],
            audio: ['audio/'],
            doc: ['application/pdf', 'text/', 'application/msword', 'application/vnd'],
            archive: ['application/zip', 'application/x-rar', 'application/x-tar', 'application/gzip'],
          };
          const typeKey = args[0].toLowerCase();
          const mimePatterns = typeMap[typeKey];
          if (!mimePatterns) {
            addLine('error', `Unknown type: ${typeKey}. Use: image, pdf, video, audio, doc, archive`);
            break;
          }
          const matches2 = files.filter(f => 
            f.mime_type && mimePatterns.some(p => f.mime_type.startsWith(p))
          );
          if (matches2.length === 0) {
            addLine('info', `No ${typeKey} files found`);
          } else {
            const output = matches2.map(f => `  ${f.name}  ${formatSize(f.size_bytes)}  ${formatDate(f.created_at)}`).join('\n');
            addLine('output', output);
            addLine('info', `${matches2.length} ${typeKey} file(s)`);
          }
          break;
        }

        case 'upload': {
          callbacks.onUploadClick();
          addLine('info', 'Upload dialog opened');
          break;
        }

        case 'restore': {
          addLine('info', 'Use the Trash page to restore files');
          break;
        }

        case 'ai': {
          if (args.length === 0) {
            addLine('error', 'Usage: ai <natural language command>');
            break;
          }
          const query = args.join(' ');
          addLine('info', '🤖 Processing...');
          
          try {
            const { data, error } = await supabase.functions.invoke('terminal-ai', {
              body: { query, currentPath: getPathString() },
            });
            
            if (error) throw error;
            
            if (data?.command) {
              addLine('info', `→ Interpreted as: ${data.command}`);
              // Execute the interpreted command
              await executeCommand(data.command);
            } else if (data?.response) {
              addLine('output', data.response);
            } else {
              addLine('error', 'AI could not interpret the command');
            }
          } catch (err: any) {
            addLine('error', `AI error: ${err.message || 'Failed to process'}`);
          }
          break;
        }

        default: {
          addLine('error', `Command not found: ${command}. Type 'help' for available commands.`);
        }
      }
    } catch (err: any) {
      addLine('error', `Error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [addLine, userId, files, folders, callbacks, getCurrentFolderFiles, getCurrentFolderSubfolders, resolveFileName, resolveFolderName, getPathString, commandHistory]);

  const getAutocomplete = useCallback((input: string): string[] => {
    const parts = input.split(/\s+/);
    
    // Command autocomplete
    if (parts.length <= 1) {
      const partial = parts[0].toLowerCase();
      return ALL_COMMANDS.filter(cmd => cmd.startsWith(partial));
    }

    // File/folder name autocomplete
    const partial = parts.slice(1).join(' ').toLowerCase();
    const command = parts[0].toLowerCase();
    
    const fileSuggestions = getCurrentFolderFiles()
      .map(f => f.name)
      .filter(name => name.toLowerCase().startsWith(partial));
    
    const folderSuggestions = getCurrentFolderSubfolders()
      .map(f => f.name + '/')
      .filter(name => name.toLowerCase().startsWith(partial));

    if (['cd', 'rmdir'].includes(command)) {
      return folderSuggestions;
    }

    return [...folderSuggestions, ...fileSuggestions].slice(0, 10);
  }, [getCurrentFolderFiles, getCurrentFolderSubfolders]);

  const syncFolderState = useCallback((folderId: string | null) => {
    termState.current.currentFolderId = folderId;
  }, []);

  return {
    lines,
    commandHistory,
    historyIndex,
    setHistoryIndex,
    isProcessing,
    executeCommand,
    getAutocomplete,
    addLine,
    clearLines: () => setLines([]),
    syncFolderState,
  };
};
