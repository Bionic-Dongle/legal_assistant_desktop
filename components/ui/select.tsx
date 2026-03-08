
'use client';

import * as React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
  group?: string;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  id?: string;
}

export function Select({ value, onValueChange, options, placeholder, className, id }: SelectProps) {
  const [open, setOpen] = React.useState(false);

  // Group options
  const groups: Record<string, SelectOption[]> = {};
  const ungrouped: SelectOption[] = [];
  for (const opt of options) {
    if (opt.group) {
      if (!groups[opt.group]) groups[opt.group] = [];
      groups[opt.group].push(opt);
    } else {
      ungrouped.push(opt);
    }
  }

  const selectedLabel = options.find(o => o.value === value)?.label ?? (value || placeholder || 'Select...');
  const hasGroups = Object.keys(groups).length > 0;

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger
        id={id}
        className={cn(
          'flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground',
          'hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          'data-[state=open]:ring-2 data-[state=open]:ring-ring',
          className
        )}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={cn('ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={cn(
            'z-50 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md',
            'max-h-72 overflow-y-auto',
            'animate-in fade-in-0 zoom-in-95'
          )}
          sideOffset={4}
          align="start"
          style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}
        >
          {/* Ungrouped options first */}
          {ungrouped.map(opt => (
            <DropdownMenu.Item
              key={opt.value}
              onSelect={() => onValueChange(opt.value)}
              className={cn(
                'relative flex cursor-pointer select-none items-center px-3 py-2 text-sm outline-none',
                'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
                value === opt.value && 'bg-accent/50 font-medium'
              )}
            >
              <span className="flex-1">{opt.label}</span>
              {value === opt.value && <Check className="ml-2 h-4 w-4 shrink-0" />}
            </DropdownMenu.Item>
          ))}

          {/* Grouped options */}
          {Object.entries(groups).map(([groupName, groupOpts], idx) => (
            <React.Fragment key={groupName}>
              {(idx > 0 || ungrouped.length > 0) && (
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
              )}
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">{groupName}</div>
              {groupOpts.map(opt => (
                <DropdownMenu.Item
                  key={opt.value}
                  onSelect={() => onValueChange(opt.value)}
                  className={cn(
                    'relative flex cursor-pointer select-none items-center px-3 py-2 text-sm outline-none',
                    'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
                    value === opt.value && 'bg-accent/50 font-medium'
                  )}
                >
                  <span className="flex-1">{opt.label}</span>
                  {value === opt.value && <Check className="ml-2 h-4 w-4 shrink-0" />}
                </DropdownMenu.Item>
              ))}
            </React.Fragment>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
