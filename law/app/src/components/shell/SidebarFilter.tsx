import { useEffect, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';

interface SidebarFilterProps {
  onChange: (value: string) => void;
}

export function SidebarFilter({ onChange }: SidebarFilterProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    const id = setTimeout(() => onChange(value.trim().toLowerCase()), 150);
    return () => clearTimeout(id);
  }, [value, onChange]);

  return (
    <div className="relative px-3 pt-3 pb-2">
      <MagnifyingGlass
        size={14}
        weight="regular"
        className="absolute left-5 top-1/2 -translate-y-[5px] text-muted-foreground pointer-events-none"
      />
      <Input
        type="text"
        placeholder="Filter jurisdictions…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 pl-7 text-xs"
        aria-label="Filter jurisdictions"
      />
    </div>
  );
}
