import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { X, Plus, Tag } from 'lucide-react';
import { useFileTags, PRESET_TAGS } from '@/hooks/useFileTags';

interface TagManagerProps {
  fileId: string;
  tags: string[];
  onTagsChange?: () => void;
}

export const TagManager = ({ fileId, tags, onTagsChange }: TagManagerProps) => {
  const [newTag, setNewTag] = useState('');
  const [open, setOpen] = useState(false);
  const { addTag, removeTag, getTagColor, loading } = useFileTags();

  const handleAddTag = async (tag: string) => {
    await addTag(fileId, tag.toLowerCase().trim());
    setNewTag('');
    onTagsChange?.();
  };

  const handleRemoveTag = async (tag: string) => {
    await removeTag(fileId, tag);
    onTagsChange?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      handleAddTag(newTag);
    }
  };

  const availablePresets = PRESET_TAGS.filter(t => !tags.includes(t));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 h-7">
          <Tag className="h-3 w-3" />
          {tags.length > 0 ? (
            <span className="text-xs">{tags.length}</span>
          ) : (
            <span className="text-xs">Add tags</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className={`${getTagColor(tag)} cursor-pointer`}
                onClick={() => handleRemoveTag(tag)}
              >
                {tag}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            ))}
            {tags.length === 0 && (
              <p className="text-xs text-muted-foreground">No tags yet</p>
            )}
          </div>

          <div className="flex gap-1">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add custom tag..."
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => newTag.trim() && handleAddTag(newTag)}
              disabled={!newTag.trim() || loading}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {availablePresets.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Suggested:</p>
              <div className="flex flex-wrap gap-1">
                {availablePresets.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className={`${getTagColor(tag)} cursor-pointer opacity-60 hover:opacity-100`}
                    onClick={() => handleAddTag(tag)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Inline display of tags for file list
interface TagDisplayProps {
  tags: string[];
  maxVisible?: number;
}

export const TagDisplay = ({ tags, maxVisible = 3 }: TagDisplayProps) => {
  const { getTagColor } = useFileTags();
  
  if (tags.length === 0) return null;

  const visible = tags.slice(0, maxVisible);
  const hidden = tags.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((tag) => (
        <Badge
          key={tag}
          variant="outline"
          className={`${getTagColor(tag)} text-xs py-0 h-5`}
        >
          {tag}
        </Badge>
      ))}
      {hidden > 0 && (
        <Badge variant="secondary" className="text-xs py-0 h-5">
          +{hidden}
        </Badge>
      )}
    </div>
  );
};
