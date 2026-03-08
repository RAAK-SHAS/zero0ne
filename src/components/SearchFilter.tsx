import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchFilter = ({ value, onChange, placeholder = 'Search files...' }: SearchFilterProps) => {
  return (
    <div className="relative group flex-1 min-w-[180px] max-w-[280px]">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "pl-9 pr-8 h-9 text-sm bg-background/50 border-border/50",
          "placeholder:text-muted-foreground/50 font-mono text-xs",
          "focus-visible:ring-primary/30 focus-visible:border-primary/40",
          "transition-all duration-200"
        )}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
