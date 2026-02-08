import { memo } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  ArrowUpDown,
  ArrowUpAZ,
  ArrowDownAZ,
  ArrowUp,
  ArrowDown,
  Calendar,
  HardDrive
} from 'lucide-react';

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
      // Toggle direction if same field
      onChange({ field, direction: value.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      // Set default direction for new field
      const defaultDirection: SortDirection = field === 'date' || field === 'size' ? 'desc' : 'asc';
      onChange({ field, direction: defaultDirection });
    }
  };

  const toggleDirection = () => {
    onChange({ ...value, direction: value.direction === 'asc' ? 'desc' : 'asc' });
  };

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{currentOption.label}</span>
            <span className="text-xs text-muted-foreground hidden md:inline">
              ({directionLabel})
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuRadioGroup value={value.field} onValueChange={(v) => handleFieldChange(v as SortField)}>
            {SORT_OPTIONS.map((option) => {
              const OptionIcon = option.icon;
              const isActive = option.field === value.field;
              return (
                <DropdownMenuRadioItem 
                  key={option.field} 
                  value={option.field}
                  className="flex items-center justify-between"
                >
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
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start gap-2"
              onClick={toggleDirection}
            >
              {value.direction === 'asc' ? (
                <>
                  <ArrowUp className="h-4 w-4" />
                  Switch to descending
                </>
              ) : (
                <>
                  <ArrowDown className="h-4 w-4" />
                  Switch to ascending
                </>
              )}
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

SortControl.displayName = 'SortControl';
