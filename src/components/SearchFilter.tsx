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
    <div className="relative group flex-1 min-w-[220px] max-w-[420px]">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "pl-10 pr-16 h-10 text-sm bg-card/60 border-border/70 shadow-sm",
          "placeholder:text-muted-foreground/55",
          "focus-visible:ring-primary/25 focus-visible:border-primary/35",
          "transition-all duration-200"
        )}
      />
      {value && (
        <span className="pointer-events-none absolute right-8 top-1/2 hidden -translate-y-1/2 text-[10px] text-muted-foreground/70 sm:inline">
          {value.length} chars
        </span>
      )}
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
