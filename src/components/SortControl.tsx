import { memo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { 
  ArrowUpAZ,
  ArrowUp,
  ArrowDown,
  Calendar,
  HardDrive
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortField = 'name' | 'date' | 'size';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface SortControlProps {
  value: SortConfig;
  onChange: (value: SortConfig) => void;
}

const SORT_OPTIONS: { field: SortField; label: string; icon: React.ElementType; ascLabel: string; descLabel: string }[] = [
  { field: 'name', label: 'Name', icon: ArrowUpAZ, ascLabel: 'A → Z', descLabel: 'Z → A' },
  { field: 'date', label: 'Date', icon: Calendar, ascLabel: 'Oldest first', descLabel: 'Newest first' },
  { field: 'size', label: 'Size', icon: HardDrive, ascLabel: 'Smallest first', descLabel: 'Largest first' },
];

export const SortControl = memo(({ value, onChange }: SortControlProps) => {
  const currentOption = SORT_OPTIONS.find(o => o.field === value.field)!;
  const Icon = currentOption.icon;
  const directionLabel = value.direction === 'asc' ? currentOption.ascLabel : currentOption.descLabel;

  const handleFieldChange = (field: SortField) => {
    if (field === value.field) {
      onChange({ field, direction: value.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      const defaultDirection: SortDirection = field === 'date' || field === 'size' ? 'desc' : 'asc';
      onChange({ field, direction: defaultDirection });
    }
  };

  const toggleDirection = () => {
    onChange({ ...value, direction: value.direction === 'asc' ? 'desc' : 'asc' });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(
          "flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-mono transition-all duration-200",
          "border border-border/50 bg-background/50",
          "hover:border-primary/30 hover:bg-primary/5"
        )}>
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{currentOption.label}</span>
          <span className="text-[10px] text-muted-foreground hidden md:inline">
            ({directionLabel})
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuRadioGroup value={value.field} onValueChange={(v) => handleFieldChange(v as SortField)}>
          {SORT_OPTIONS.map((option) => {
            const OptionIcon = option.icon;
            const isActive = option.field === value.field;
            return (
              <DropdownMenuRadioItem key={option.field} value={option.field} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <OptionIcon className="h-4 w-4" />
                  <span>{option.label}</span>
                </div>
                {isActive && (
                  <span className="text-xs text-muted-foreground">
                    {value.direction === 'asc' ? option.ascLabel : option.descLabel}
                  </span>
                )}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={toggleDirection}>
            {value.direction === 'asc' ? (
              <><ArrowUp className="h-4 w-4" />Switch to descending</>
            ) : (
              <><ArrowDown className="h-4 w-4" />Switch to ascending</>
            )}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

SortControl.displayName = 'SortControl';
