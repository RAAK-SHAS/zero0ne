/**
 * Extended Linux command handlers for the cloud terminal.
 * These simulate common Unix commands within the virtual filesystem.
 */

type CollectLine = (type: 'input' | 'output' | 'error' | 'info' | 'success' | 'system', content: string) => void;

interface CommandContext {
  args: string[];
  flags: Set<string>;
  rawArgs: string;
  collectLine: CollectLine;
  getCurrentFolderFiles: () => any[];
  getCurrentFolderSubfolders: () => any[];
  resolveFileName: (name: string) => any | null;
  resolveFolderName: (name: string) => any | null;
  getPathString: () => string;
  files: any[];
  folders: any[];
  userId: string | undefined;
  pipedInput: string[];
  formatSize: (bytes: number) => string;
  formatDate: (dateStr: string) => string;
  callbacks: any;
  termState: { currentFolderId: string | null };
}

// Parse flags from args (e.g. -r, -f, --recursive)
export function parseFlags(args: string[]): { flags: Set<string>; positional: string[] } {
  const flags = new Set<string>();
  const positional: string[] = [];
  for (const a of args) {
    if (a.startsWith('--')) {
      flags.add(a.slice(2));
    } else if (a.startsWith('-') && a.length > 1 && !/^\d/.test(a[1])) {
      for (const c of a.slice(1)) flags.add(c);
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

const SIM = 'Command simulated in cloud environment.';

// Text-processing helpers
function processGrep(pattern: string, lines: string[], flags: Set<string>): string[] {
  const ignoreCase = flags.has('i');
  const invert = flags.has('v');
  const showCount = flags.has('c');
  const showLineNum = flags.has('n');
  try {
    const re = new RegExp(pattern, ignoreCase ? 'i' : '');
    const matched = lines
      .map((l, i) => ({ line: l, num: i + 1 }))
      .filter(({ line }) => invert ? !re.test(line) : re.test(line));
    if (showCount) return [`${matched.length}`];
    return matched.map(({ line, num }) => showLineNum ? `${num}:${line}` : line);
  } catch {
    return [`grep: invalid regex: ${pattern}`];
  }
}

function processSort(lines: string[], flags: Set<string>): string[] {
  const result = [...lines];
  if (flags.has('n')) {
    result.sort((a, b) => parseFloat(a) - parseFloat(b));
  } else {
    result.sort((a, b) => flags.has('f') ? a.toLowerCase().localeCompare(b.toLowerCase()) : a.localeCompare(b));
  }
  if (flags.has('r')) result.reverse();
  if (flags.has('u')) {
    const seen = new Set<string>();
    return result.filter(l => { if (seen.has(l)) return false; seen.add(l); return true; });
  }
  return result;
}

function processUniq(lines: string[], flags: Set<string>): string[] {
  const showCount = flags.has('c');
  const onlyDupes = flags.has('d');
  const onlyUnique = flags.has('u');
  const result: { line: string; count: number }[] = [];
  for (const line of lines) {
    if (result.length > 0 && result[result.length - 1].line === line) {
      result[result.length - 1].count++;
    } else {
      result.push({ line, count: 1 });
    }
  }
  return result
    .filter(r => {
      if (onlyDupes) return r.count > 1;
      if (onlyUnique) return r.count === 1;
      return true;
    })
    .map(r => showCount ? `${String(r.count).padStart(7)} ${r.line}` : r.line);
}

function processWc(lines: string[], flags: Set<string>): string {
  const text = lines.join('\n');
  const lineCount = lines.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const charCount = text.length;
  if (flags.has('l')) return `${lineCount}`;
  if (flags.has('w')) return `${wordCount}`;
  if (flags.has('c')) return `${charCount}`;
  return `  ${lineCount}  ${wordCount}  ${charCount}`;
}

/**
 * Returns a handler function for extended Linux commands, or null if not recognized.
 */
export function getExtendedCommandHandler(command: string): ((ctx: CommandContext) => Promise<string[]>) | null {
  const handlers: Record<string, (ctx: CommandContext) => Promise<string[]>> = {
    // === File viewing ===
    cat: async (ctx) => {
      const out: string[] = [];
      if (ctx.pipedInput.length > 0) {
        ctx.pipedInput.forEach(l => ctx.collectLine('output', l));
        return ctx.pipedInput;
      }
      if (ctx.args.length === 0) { ctx.collectLine('error', 'cat: missing file operand'); return []; }
      const file = ctx.resolveFileName(ctx.args.join(' '));
      if (file) {
        ctx.callbacks.onPreview(file.id);
        ctx.collectLine('info', `Opening: ${file.name}`);
      } else {
        ctx.collectLine('error', `cat: ${ctx.args.join(' ')}: No such file`);
      }
      return out;
    },

    tac: async (ctx) => {
      if (ctx.pipedInput.length > 0) {
        const reversed = [...ctx.pipedInput].reverse();
        reversed.forEach(l => ctx.collectLine('output', l));
        return reversed;
      }
      ctx.collectLine('info', 'tac: reverses file content. Pipe input or specify a file.');
      return [];
    },

    nl: async (ctx) => {
      const lines = ctx.pipedInput.length > 0 ? ctx.pipedInput : [];
      if (lines.length === 0) { ctx.collectLine('info', 'nl: number lines of input. Use with pipe.'); return []; }
      const out = lines.map((l, i) => `${String(i + 1).padStart(6)}\t${l}`);
      out.forEach(l => ctx.collectLine('output', l));
      return out;
    },

    head: async (ctx) => {
      const n = ctx.flags.has('n') ? parseInt(ctx.args[0] || '10') : (ctx.args[0]?.startsWith('-') ? parseInt(ctx.args[0].slice(1)) : 10);
      const count = isNaN(n) ? 10 : n;
      if (ctx.pipedInput.length > 0) {
        const out = ctx.pipedInput.slice(0, count);
        out.forEach(l => ctx.collectLine('output', l));
        return out;
      }
      const files = ctx.getCurrentFolderFiles().slice(0, count);
      const out = files.map(f => `  ${f.name}  ${ctx.formatSize(f.size_bytes)}`);
      out.forEach(l => ctx.collectLine('output', l));
      return out;
    },

    tail: async (ctx) => {
      const n = 10;
      if (ctx.pipedInput.length > 0) {
        const out = ctx.pipedInput.slice(-n);
        out.forEach(l => ctx.collectLine('output', l));
        return out;
      }
      const files = ctx.getCurrentFolderFiles().slice(-n);
      const out = files.map(f => `  ${f.name}  ${ctx.formatSize(f.size_bytes)}`);
      out.forEach(l => ctx.collectLine('output', l));
      return out;
    },

    less: async (ctx) => { ctx.collectLine('info', 'less: pager not available in cloud terminal. Use cat or head/tail.'); return []; },
    more: async (ctx) => { ctx.collectLine('info', 'more: pager not available in cloud terminal. Use cat or head/tail.'); return []; },

    od: async (ctx) => { ctx.collectLine('info', `od: ${SIM} Binary dump not supported.`); return []; },
    xxd: async (ctx) => { ctx.collectLine('info', `xxd: ${SIM} Hex dump not supported.`); return []; },
    hexdump: async (ctx) => { ctx.collectLine('info', `hexdump: ${SIM}`); return []; },
    strings: async (ctx) => { ctx.collectLine('info', `strings: ${SIM} Use cat to view text files.`); return []; },

    // === File creation ===
    touch: async (ctx) => {
      if (ctx.args.length === 0) { ctx.collectLine('error', 'touch: missing file operand'); return []; }
      ctx.collectLine('info', `touch: File creation requires upload. Use 'upload' command.`);
      return [];
    },

    install: async (ctx) => { ctx.collectLine('info', `install: ${SIM}`); return []; },
    truncate: async (ctx) => { ctx.collectLine('info', `truncate: ${SIM} File truncation not supported in cloud storage.`); return []; },
    mktemp: async (ctx) => {
      const tmpName = `tmp.${Date.now().toString(36)}`;
      ctx.collectLine('output', `/tmp/${tmpName}`);
      return [`/tmp/${tmpName}`];
    },
    tempfile: async (ctx) => {
      const tmpName = `tmp.${Date.now().toString(36)}`;
      ctx.collectLine('output', `/tmp/${tmpName}`);
      return [`/tmp/${tmpName}`];
    },

    // === File information ===
    stat: async (ctx) => {
      if (ctx.args.length === 0) { ctx.collectLine('error', 'stat: missing operand'); return []; }
      const file = ctx.resolveFileName(ctx.args.join(' '));
      if (!file) {
        const folder = ctx.resolveFolderName(ctx.args.join(' '));
        if (folder) {
          const out = [
            `  File: ${folder.name}/`,
            `  Type: directory`,
            `  Created: ${ctx.formatDate(folder.created_at)}`,
            `  Modified: ${ctx.formatDate(folder.updated_at)}`,
            `  Hidden: ${folder.is_hidden}`,
            `  Locked: ${folder.is_locked}`,
          ];
          out.forEach(l => ctx.collectLine('output', l));
          return out;
        }
        ctx.collectLine('error', `stat: cannot stat '${ctx.args.join(' ')}': No such file or directory`);
        return [];
      }
      const out = [
        `  File: ${file.name}`,
        `  Size: ${ctx.formatSize(file.size_bytes)} (${file.size_bytes} bytes)`,
        `  Type: ${file.mime_type || 'unknown'}`,
        `  Created: ${ctx.formatDate(file.created_at)}`,
        `  Encrypted: ${file.is_encrypted || false}`,
        `  Favorite: ${file.is_favorite || false}`,
        `  Tags: ${(file.tags || []).join(', ') || 'none'}`,
      ];
      out.forEach(l => ctx.collectLine('output', l));
      return out;
    },

    file: async (ctx) => {
      if (ctx.args.length === 0) { ctx.collectLine('error', 'file: missing operand'); return []; }
      const f = ctx.resolveFileName(ctx.args.join(' '));
      if (f) {
        const out = `${f.name}: ${f.mime_type || 'data'}`;
        ctx.collectLine('output', out);
        return [out];
      }
      ctx.collectLine('error', `file: ${ctx.args.join(' ')}: No such file`);
      return [];
    },

    df: async (ctx) => {
      ctx.collectLine('output', 'Filesystem      Size  Used  Avail  Use%  Mounted on');
      ctx.collectLine('output', 'cloudstore      100T   0B   100T    0%  /');
      ctx.collectLine('info', 'Use "du" for actual storage usage.');
      return [];
    },

    readlink: async (ctx) => { ctx.collectLine('info', `readlink: ${SIM} No symbolic links in cloud storage.`); return []; },
    realpath: async (ctx) => {
      const path = ctx.args.join(' ') || '.';
      if (path === '.') { ctx.collectLine('output', ctx.getPathString()); return [ctx.getPathString()]; }
      ctx.collectLine('output', ctx.getPathString() + '/' + path);
      return [ctx.getPathString() + '/' + path];
    },

    basename: async (ctx) => {
      if (ctx.args.length === 0) { ctx.collectLine('error', 'basename: missing operand'); return []; }
      const p = ctx.args[0];
      const base = p.split('/').filter(Boolean).pop() || p;
      ctx.collectLine('output', base);
      return [base];
    },

    dirname: async (ctx) => {
      if (ctx.args.length === 0) { ctx.collectLine('error', 'dirname: missing operand'); return []; }
      const parts = ctx.args[0].split('/').filter(Boolean);
      parts.pop();
      const dir = parts.length > 0 ? '/' + parts.join('/') : '/';
      ctx.collectLine('output', dir);
      return [dir];
    },

    pathchk: async (ctx) => {
      if (ctx.args.length === 0) { ctx.collectLine('error', 'pathchk: missing operand'); return []; }
      const name = ctx.args.join(' ');
      const invalid = /[<>:"|?*\x00-\x1f]/.test(name);
      if (invalid) {
        ctx.collectLine('error', `pathchk: '${name}': contains invalid characters`);
      } else {
        ctx.collectLine('success', `pathchk: '${name}': valid path`);
      }
      return [];
    },

    // === File copy / delete (extending existing) ===
    cp: async (ctx) => {
      if (ctx.args.length < 1) {
        ctx.collectLine('error', 'cp: missing operand. Usage: cp <source> [destination]');
        return [];
      }
      if (!ctx.userId) {
        ctx.collectLine('error', 'cp: not authenticated');
        return [];
      }
      const srcName = ctx.args[0];
      const dstArg = ctx.args[1];
      const src = ctx.resolveFileName(srcName);
      if (!src) {
        ctx.collectLine('error', `cp: cannot stat '${srcName}': No such file`);
        return [];
      }

      // Determine destination: folder name -> copy with same name into that folder
      // Otherwise treat as new filename in current folder
      let targetFolderId: string | null = ctx.termState.currentFolderId;
      let newName = src.name;
      if (dstArg) {
        const folder = ctx.resolveFolderName(dstArg);
        if (folder) {
          targetFolderId = folder.id;
        } else {
          newName = dstArg;
        }
      } else {
        // Default: copy in current folder with "_copy" suffix
        const dot = src.name.lastIndexOf('.');
        newName = dot > 0
          ? `${src.name.slice(0, dot)}_copy${src.name.slice(dot)}`
          : `${src.name}_copy`;
      }

      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const newStoragePath = `${ctx.userId}/${crypto.randomUUID()}_${newName}`;
        const { error: copyErr } = await supabase.storage
          .from('user-files')
          .copy(src.storage_path, newStoragePath);
        if (copyErr) {
          ctx.collectLine('error', `cp: storage copy failed: ${copyErr.message}`);
          return [];
        }
        const { error: dbErr } = await supabase.from('files').insert({
          user_id: ctx.userId,
          name: newName,
          size_bytes: src.size_bytes,
          mime_type: src.mime_type || 'application/octet-stream',
          storage_path: newStoragePath,
          folder_id: targetFolderId,
          is_encrypted: src.is_encrypted || false,
          encryption_algorithm: src.encryption_algorithm || null,
          encryption_metadata: src.encryption_metadata || null,
          tags: src.tags || null,
        });
        if (dbErr) {
          await supabase.storage.from('user-files').remove([newStoragePath]);
          ctx.collectLine('error', `cp: database insert failed: ${dbErr.message}`);
          return [];
        }
        ctx.collectLine('success', `Copied '${src.name}' → '${newName}'`);
        ctx.callbacks.refreshData?.();
      } catch (e: any) {
        ctx.collectLine('error', `cp: ${e?.message || 'unknown error'}`);
      }
      return [];
    },

    rm: async (ctx) => {
      // Already aliased to delete in main handler, but handle here too for flags
      if (ctx.args.length === 0) { ctx.collectLine('error', 'rm: missing operand'); return []; }
      const name = ctx.args.join(' ');
      const f = ctx.resolveFileName(name);
      if (f) {
        if (ctx.flags.has('i')) {
          ctx.collectLine('info', `rm: confirm delete of '${f.name}'? (auto-confirmed in terminal)`);
        }
        ctx.callbacks.onDelete(f.id);
        ctx.collectLine('success', `Moved to trash: ${f.name}`);
      } else {
        ctx.collectLine('error', `rm: cannot remove '${name}': No such file`);
      }
      return [];
    },

    unlink: async (ctx) => {
      if (ctx.args.length === 0) { ctx.collectLine('error', 'unlink: missing operand'); return []; }
      const f = ctx.resolveFileName(ctx.args.join(' '));
      if (f) {
        ctx.callbacks.onDelete(f.id);
        ctx.collectLine('success', `Moved to trash: ${f.name}`);
      } else {
        ctx.collectLine('error', `unlink: cannot unlink '${ctx.args.join(' ')}': No such file`);
      }
      return [];
    },

    mv: async (ctx) => {
      ctx.collectLine('info', 'mv: Use the "move" command instead. E.g.: move file.txt FolderName');
      return [];
    },

    // === Search ===
    locate: async (ctx) => {
      if (ctx.args.length === 0) { ctx.collectLine('error', 'locate: no pattern specified'); return []; }
      const keyword = ctx.args.join(' ').toLowerCase();
      const matches = ctx.files.filter(f => f.name.toLowerCase().includes(keyword));
      if (matches.length === 0) { ctx.collectLine('info', `locate: no results for '${ctx.args.join(' ')}'`); return []; }
      const out = matches.map(f => {
        const folderName = f.folder_id ? ctx.folders.find((fo: any) => fo.id === f.folder_id)?.name || '?' : '';
        return `/${folderName ? folderName + '/' : ''}${f.name}`;
      });
      out.forEach(l => ctx.collectLine('output', l));
      ctx.collectLine('info', `${matches.length} result(s)`);
      return out;
    },
    mlocate: async (ctx) => { return handlers.locate!(ctx); },
    plocate: async (ctx) => { return handlers.locate!(ctx); },
    updatedb: async (ctx) => { ctx.collectLine('success', 'updatedb: database updated (cloud index is always current).'); return []; },

    which: async (ctx) => {
      if (ctx.args.length === 0) { ctx.collectLine('error', 'which: missing argument'); return []; }
      const cmd = ctx.args[0];
      const ALL_CMDS = ['ls','cd','pwd','tree','cat','head','tail','grep','sort','wc','find','stat','du','df','mkdir','rmdir','touch','rm','mv','cp','chmod','chown','tar','gzip','zip','diff','ln','tee','xargs','echo','whoami','history','clear','help','ai','upload','download','share','rename','delete','move','search','type','open','preview','restore','trash'];
      if (ALL_CMDS.includes(cmd)) {
        ctx.collectLine('output', `/usr/bin/${cmd}`);
      } else {
        ctx.collectLine('error', `which: no ${cmd} in PATH`);
      }
      return [];
    },

    whereis: async (ctx) => {
      if (ctx.args.length === 0) { ctx.collectLine('error', 'whereis: missing argument'); return []; }
      ctx.collectLine('output', `${ctx.args[0]}: /usr/bin/${ctx.args[0]}`);
      return [];
    },

    // === File comparison ===
    diff: async (ctx) => { ctx.collectLine('info', `diff: ${SIM} File comparison not available.`); return []; },
    sdiff: async (ctx) => { ctx.collectLine('info', `sdiff: ${SIM}`); return []; },
    cmp: async (ctx) => { ctx.collectLine('info', `cmp: ${SIM}`); return []; },
    comm: async (ctx) => { ctx.collectLine('info', `comm: ${SIM}`); return []; },

    // === Permissions ===
    chmod: async (ctx) => {
      if (ctx.args.length < 2) { ctx.collectLine('error', 'chmod: missing operand'); return []; }
      ctx.collectLine('info', `chmod: ${SIM} Cloud files use access policies, not Unix permissions.`);
      return [];
    },
    chown: async (ctx) => { ctx.collectLine('info', `chown: ${SIM} All files are owned by the authenticated user.`); return []; },
    chgrp: async (ctx) => { ctx.collectLine('info', `chgrp: ${SIM} No group concept in cloud storage.`); return []; },
    umask: async (ctx) => { ctx.collectLine('output', '0022'); return ['0022']; },

    // === Links ===
    ln: async (ctx) => { ctx.collectLine('info', `ln: ${SIM} Use 'share' to create file links.`); return []; },
    link: async (ctx) => { ctx.collectLine('info', `link: ${SIM} Use 'share' to create file links.`); return []; },

    // === Text processing ===
    grep: async (ctx) => {
      if (ctx.args.length === 0 && ctx.pipedInput.length === 0) {
        ctx.collectLine('error', 'grep: missing pattern');
        return [];
      }
      const pattern = ctx.args[0] || '';
      const input = ctx.pipedInput.length > 0 ? ctx.pipedInput : [];
      if (input.length === 0) {
        // Search file names
        const matches = ctx.files.filter(f => new RegExp(pattern, ctx.flags.has('i') ? 'i' : '').test(f.name));
        const out = matches.map(f => `  ${f.name}  (${ctx.formatSize(f.size_bytes)})`);
        out.forEach(l => ctx.collectLine('output', l));
        ctx.collectLine('info', `${matches.length} match(es)`);
        return out;
      }
      const result = processGrep(pattern, input, ctx.flags);
      result.forEach(l => ctx.collectLine('output', l));
      return result;
    },
    egrep: async (ctx) => { return handlers.grep!(ctx); },
    fgrep: async (ctx) => { return handlers.grep!(ctx); },

    sort: async (ctx) => {
      const input = ctx.pipedInput.length > 0 ? ctx.pipedInput : [];
      if (input.length === 0) { ctx.collectLine('info', 'sort: no input. Use with pipe.'); return []; }
      const result = processSort(input, ctx.flags);
      result.forEach(l => ctx.collectLine('output', l));
      return result;
    },

    uniq: async (ctx) => {
      const input = ctx.pipedInput.length > 0 ? ctx.pipedInput : [];
      if (input.length === 0) { ctx.collectLine('info', 'uniq: no input. Use with pipe.'); return []; }
      const result = processUniq(input, ctx.flags);
      result.forEach(l => ctx.collectLine('output', l));
      return result;
    },

    cut: async (ctx) => {
      const input = ctx.pipedInput.length > 0 ? ctx.pipedInput : [];
      if (input.length === 0) { ctx.collectLine('info', 'cut: no input. Use with pipe.'); return []; }
      // Simple: cut by spaces, use -f flag
      const fieldIdx = ctx.args.indexOf('-f') >= 0 ? parseInt(ctx.args[ctx.args.indexOf('-f') + 1] || '1') - 1 : 0;
      const delim = ctx.args.indexOf('-d') >= 0 ? ctx.args[ctx.args.indexOf('-d') + 1] || ' ' : ' ';
      const out = input.map(l => l.split(delim)[fieldIdx] || '');
      out.forEach(l => ctx.collectLine('output', l));
      return out;
    },

    paste: async (ctx) => { ctx.collectLine('info', `paste: ${SIM}`); return []; },
    join: async (ctx) => { ctx.collectLine('info', `join: ${SIM}`); return []; },

    awk: async (ctx) => {
      const input = ctx.pipedInput.length > 0 ? ctx.pipedInput : [];
      if (input.length === 0) { ctx.collectLine('info', 'awk: no input. Use with pipe.'); return []; }
      // Simple: print specific field. Support '{print $N}'
      const printMatch = ctx.rawArgs.match(/\{.*print\s+\$(\d+).*\}/);
      const fieldNum = printMatch ? parseInt(printMatch[1]) - 1 : 0;
      const out = input.map(l => {
        const fields = l.trim().split(/\s+/);
        return fields[fieldNum] || '';
      }).filter(Boolean);
      out.forEach(l => ctx.collectLine('output', l));
      return out;
    },

    sed: async (ctx) => {
      const input = ctx.pipedInput.length > 0 ? ctx.pipedInput : [];
      if (input.length === 0) { ctx.collectLine('info', 'sed: no input. Use with pipe.'); return []; }
      // Simple s/pattern/replacement/flags
      const sedExpr = ctx.args[0] || '';
      const sedMatch = sedExpr.match(/^s\/(.+?)\/(.*)\/([gi]*)$/);
      if (!sedMatch) {
        ctx.collectLine('error', `sed: invalid expression: ${sedExpr}`);
        return [];
      }
      const [, pattern, replacement, sedFlags] = sedMatch;
      const re = new RegExp(pattern, sedFlags.includes('i') ? 'gi' : sedFlags.includes('g') ? 'g' : '');
      const out = input.map(l => l.replace(re, replacement));
      out.forEach(l => ctx.collectLine('output', l));
      return out;
    },

    tr: async (ctx) => {
      const input = ctx.pipedInput.length > 0 ? ctx.pipedInput : [];
      if (input.length === 0 || ctx.args.length < 2) { ctx.collectLine('info', 'tr: translate characters. Usage: tr SET1 SET2 (with pipe)'); return []; }
      const set1 = ctx.args[0];
      const set2 = ctx.args[1];
      const out = input.map(l => {
        let result = l;
        for (let i = 0; i < set1.length && i < set2.length; i++) {
          result = result.split(set1[i]).join(set2[i]);
        }
        return result;
      });
      out.forEach(l => ctx.collectLine('output', l));
      return out;
    },

    wc: async (ctx) => {
      const input = ctx.pipedInput.length > 0 ? ctx.pipedInput : [];
      if (input.length === 0) {
        // Count files in current dir
        const fileCount = ctx.getCurrentFolderFiles().length;
        const folderCount = ctx.getCurrentFolderSubfolders().length;
        ctx.collectLine('output', `${fileCount} files, ${folderCount} folders in current directory`);
        return [];
      }
      const result = processWc(input, ctx.flags);
      ctx.collectLine('output', result);
      return [result];
    },

    fold: async (ctx) => { ctx.collectLine('info', `fold: ${SIM}`); return []; },
    fmt: async (ctx) => { ctx.collectLine('info', `fmt: ${SIM}`); return []; },
    pr: async (ctx) => { ctx.collectLine('info', `pr: ${SIM}`); return []; },
    split: async (ctx) => { ctx.collectLine('info', `split: ${SIM} File splitting not supported in cloud storage.`); return []; },
    csplit: async (ctx) => { ctx.collectLine('info', `csplit: ${SIM}`); return []; },
    expand: async (ctx) => {
      const input = ctx.pipedInput.length > 0 ? ctx.pipedInput : [];
      const out = input.map(l => l.replace(/\t/g, '        '));
      out.forEach(l => ctx.collectLine('output', l));
      return out;
    },
    unexpand: async (ctx) => {
      const input = ctx.pipedInput.length > 0 ? ctx.pipedInput : [];
      const out = input.map(l => l.replace(/        /g, '\t'));
      out.forEach(l => ctx.collectLine('output', l));
      return out;
    },

    // === Compression ===
    tar: async (ctx) => { ctx.collectLine('info', `tar: ${SIM} Use the archive manager in the UI to create/extract archives.`); return []; },
    gzip: async (ctx) => { ctx.collectLine('info', `gzip: ${SIM} Compression handled by the archive manager.`); return []; },
    gunzip: async (ctx) => { ctx.collectLine('info', `gunzip: ${SIM}`); return []; },
    zcat: async (ctx) => { ctx.collectLine('info', `zcat: ${SIM}`); return []; },
    zgrep: async (ctx) => { ctx.collectLine('info', `zgrep: ${SIM}`); return []; },
    zless: async (ctx) => { ctx.collectLine('info', `zless: ${SIM}`); return []; },
    zmore: async (ctx) => { ctx.collectLine('info', `zmore: ${SIM}`); return []; },
    bzip2: async (ctx) => { ctx.collectLine('info', `bzip2: ${SIM}`); return []; },
    bunzip2: async (ctx) => { ctx.collectLine('info', `bunzip2: ${SIM}`); return []; },
    bzcat: async (ctx) => { ctx.collectLine('info', `bzcat: ${SIM}`); return []; },
    xz: async (ctx) => { ctx.collectLine('info', `xz: ${SIM}`); return []; },
    unxz: async (ctx) => { ctx.collectLine('info', `unxz: ${SIM}`); return []; },
    lzma: async (ctx) => { ctx.collectLine('info', `lzma: ${SIM}`); return []; },
    unlzma: async (ctx) => { ctx.collectLine('info', `unlzma: ${SIM}`); return []; },
    lzcat: async (ctx) => { ctx.collectLine('info', `lzcat: ${SIM}`); return []; },
    zip: async (ctx) => { ctx.collectLine('info', `zip: Use the archive manager UI to create ZIP files from selected files.`); return []; },
    unzip: async (ctx) => {
      if (ctx.args.length === 0) { ctx.collectLine('error', 'unzip: missing file operand'); return []; }
      const f = ctx.resolveFileName(ctx.args.join(' '));
      if (f && /\.(zip|rar|7z|tar|gz)$/i.test(f.name)) {
        ctx.collectLine('info', `Opening archive manager for: ${f.name}`);
        // Trigger archive extraction via callback if available
      } else {
        ctx.collectLine('error', `unzip: '${ctx.args.join(' ')}' not found or not an archive`);
      }
      return [];
    },

    // === Disk ===
    mount: async (ctx) => {
      ctx.collectLine('output', 'cloudstore on / type cloudfs (rw,encrypted)');
      ctx.collectLine('output', 'tmpfs on /tmp type tmpfs (rw,nosuid)');
      return [];
    },
    umount: async (ctx) => { ctx.collectLine('error', `umount: permission denied. Cloud filesystem cannot be unmounted.`); return []; },
    lsblk: async (ctx) => {
      ctx.collectLine('output', 'NAME   SIZE TYPE MOUNTPOINT');
      ctx.collectLine('output', 'csa0   100T disk /');
      return [];
    },
    blkid: async (ctx) => {
      ctx.collectLine('output', '/dev/csa0: UUID="cloud-store-001" TYPE="cloudfs"');
      return [];
    },
    sync: async (ctx) => { ctx.collectLine('success', 'sync: all data synchronized with cloud.'); return []; },

    // === Advanced file utilities ===
    rsync: async (ctx) => { ctx.collectLine('info', `rsync: ${SIM} Use move or copy commands.`); return []; },
    watch: async (ctx) => { ctx.collectLine('info', `watch: ${SIM} Use realtime updates in the UI instead.`); return []; },
    inotifywait: async (ctx) => { ctx.collectLine('info', `inotifywait: ${SIM} Realtime file monitoring is built into the UI.`); return []; },
    inotifywatch: async (ctx) => { ctx.collectLine('info', `inotifywatch: ${SIM}`); return []; },
    lsof: async (ctx) => {
      ctx.collectLine('output', 'COMMAND   PID USER   FD TYPE DEVICE SIZE/OFF NODE NAME');
      ctx.collectLine('output', 'cloudui   1   user   cwd  DIR  cloud  4096     / ');
      return [];
    },
    fuser: async (ctx) => { ctx.collectLine('info', `fuser: ${SIM}`); return []; },
    filefrag: async (ctx) => { ctx.collectLine('info', `filefrag: ${SIM} Cloud storage is abstracted.`); return []; },
    chattr: async (ctx) => { ctx.collectLine('info', `chattr: ${SIM} Use folder lock/hide features instead.`); return []; },
    lsattr: async (ctx) => {
      const files = ctx.getCurrentFolderFiles();
      if (files.length === 0) { ctx.collectLine('info', 'No files.'); return []; }
      const out = files.slice(0, 20).map(f => {
        const attrs: string[] = [];
        if (f.is_encrypted) attrs.push('e');
        if (f.is_favorite) attrs.push('f');
        return `${attrs.join('').padEnd(4, '-')} ${f.name}`;
      });
      out.forEach(l => ctx.collectLine('output', l));
      return out;
    },
    setfacl: async (ctx) => { ctx.collectLine('info', `setfacl: ${SIM} Use sharing features for access control.`); return []; },
    getfacl: async (ctx) => { ctx.collectLine('info', `getfacl: ${SIM}`); return []; },

    // === Special operations ===
    dd: async (ctx) => { ctx.collectLine('info', `dd: ${SIM} Low-level block operations not available.`); return []; },
    tee: async (ctx) => {
      // Pass through piped input and also display it
      if (ctx.pipedInput.length > 0) {
        ctx.pipedInput.forEach(l => ctx.collectLine('output', l));
        return [...ctx.pipedInput];
      }
      ctx.collectLine('info', 'tee: reads from pipe and outputs. Use with pipe.');
      return [];
    },
    shred: async (ctx) => { ctx.collectLine('info', `shred: ${SIM} Cloud files are securely deleted via trash.`); return []; },

    // === Extended attributes ===
    setfattr: async (ctx) => { ctx.collectLine('info', `setfattr: ${SIM} Use tags for file metadata.`); return []; },
    getfattr: async (ctx) => { ctx.collectLine('info', `getfattr: ${SIM} Use tags for file metadata.`); return []; },
    attr: async (ctx) => { ctx.collectLine('info', `attr: ${SIM}`); return []; },

    // === File locking ===
    flock: async (ctx) => { ctx.collectLine('info', `flock: ${SIM} Use folder lock feature.`); return []; },
    lockfile: async (ctx) => { ctx.collectLine('info', `lockfile: ${SIM}`); return []; },

    // === Pipeline helpers ===
    xargs: async (ctx) => {
      // Simple xargs: take piped input and pass as args to the next command
      if (ctx.pipedInput.length > 0) {
        ctx.pipedInput.forEach(l => ctx.collectLine('output', l));
        return ctx.pipedInput;
      }
      ctx.collectLine('info', 'xargs: build and execute command lines from standard input. Use with pipe.');
      return [];
    },

    // === Navigation extras ===
    pushd: async (ctx) => {
      if (ctx.args.length === 0) { ctx.collectLine('error', 'pushd: no directory specified'); return []; }
      const folder = ctx.resolveFolderName(ctx.args.join(' '));
      if (folder) {
        ctx.termState.currentFolderId = folder.id;
        ctx.callbacks.onNavigateFolder(folder.id);
        ctx.collectLine('success', `${ctx.getPathString()}`);
      } else {
        ctx.collectLine('error', `pushd: ${ctx.args.join(' ')}: No such directory`);
      }
      return [];
    },
    popd: async (ctx) => {
      if (ctx.termState.currentFolderId) {
        const current = ctx.folders.find((f: any) => f.id === ctx.termState.currentFolderId);
        ctx.termState.currentFolderId = current?.parent_id || null;
        ctx.callbacks.onNavigateFolder(ctx.termState.currentFolderId);
        ctx.collectLine('success', ctx.getPathString());
      } else {
        ctx.collectLine('error', 'popd: directory stack empty');
      }
      return [];
    },
    dirs: async (ctx) => {
      ctx.collectLine('output', ctx.getPathString());
      return [ctx.getPathString()];
    },

    // === Misc ===
    echo: async (ctx) => {
      const text = ctx.args.join(' ');
      ctx.collectLine('output', text);
      return [text];
    },
  };

  return handlers[command] || null;
}

/** All extended command names for autocomplete */
export const EXTENDED_COMMANDS = [
  'cat', 'tac', 'nl', 'head', 'tail', 'less', 'more', 'od', 'xxd', 'hexdump', 'strings',
  'touch', 'install', 'truncate', 'mktemp', 'tempfile',
  'stat', 'file', 'df', 'readlink', 'realpath', 'basename', 'dirname', 'pathchk',
  'cp', 'rm', 'unlink', 'mv',
  'locate', 'mlocate', 'plocate', 'updatedb', 'which', 'whereis',
  'diff', 'sdiff', 'cmp', 'comm',
  'chmod', 'chown', 'chgrp', 'umask',
  'ln', 'link',
  'grep', 'egrep', 'fgrep', 'sort', 'uniq', 'cut', 'paste', 'join',
  'awk', 'sed', 'tr', 'wc', 'fold', 'fmt', 'pr', 'split', 'csplit', 'expand', 'unexpand',
  'tar', 'gzip', 'gunzip', 'zcat', 'zgrep', 'zless', 'zmore',
  'bzip2', 'bunzip2', 'bzcat', 'xz', 'unxz', 'lzma', 'unlzma', 'lzcat', 'zip', 'unzip',
  'mount', 'umount', 'lsblk', 'blkid', 'sync',
  'rsync', 'watch', 'inotifywait', 'inotifywatch', 'lsof', 'fuser', 'filefrag',
  'chattr', 'lsattr', 'setfacl', 'getfacl',
  'dd', 'tee', 'shred',
  'setfattr', 'getfattr', 'attr',
  'mktemp', 'tempfile',
  'flock', 'lockfile',
  'hexdump', 'od', 'xxd', 'strings',
  'xargs',
  'pushd', 'popd', 'dirs',
  'echo',
];
