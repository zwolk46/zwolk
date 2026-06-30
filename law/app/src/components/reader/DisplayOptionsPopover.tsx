import { TextAa } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  useReaderDisplayOptions,
  type ReaderFontSize,
  type ReaderMeasure,
} from '@/hooks/useReaderDisplayOptions';
import { cn } from '@/lib/utils';

interface Props {
  variant?: 'desktop' | 'mobile';
}

const FONT_SIZES: ReaderFontSize[] = [14, 16, 18, 20];
const MEASURES: ReaderMeasure[] = [60, 68, 78];

export function DisplayOptionsPopover({ variant = 'desktop' }: Props) {
  const { fontSize, measure, setFontSize, setMeasure } = useReaderDisplayOptions();

  const trigger = (
    <Button
      variant="ghost"
      size={variant === 'desktop' ? 'icon' : 'icon-sm'}
      aria-label="Display options"
    >
      <TextAa size={variant === 'desktop' ? 18 : 20} weight="regular" />
    </Button>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        {variant === 'desktop' ? (
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent side="left">Display options</TooltipContent>
          </Tooltip>
        ) : (
          trigger
        )}
      </PopoverTrigger>
      <PopoverContent side={variant === 'desktop' ? 'left' : 'top'} className="w-64 space-y-5">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Font size</p>
          <div role="radiogroup" className="grid grid-cols-4 gap-1">
            {FONT_SIZES.map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={fontSize === s}
                onClick={() => setFontSize(s)}
                className={cn(
                  'h-8 rounded-md text-xs font-mono tabular-nums border transition-colors duration-(--dur-1)',
                  fontSize === s
                    ? 'bg-primary text-primary-foreground border-transparent'
                    : 'bg-background text-foreground border-border hover:bg-muted'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Measure (ch)</p>
          <div role="radiogroup" className="grid grid-cols-3 gap-1">
            {MEASURES.map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={measure === m}
                onClick={() => setMeasure(m)}
                className={cn(
                  'h-8 rounded-md text-xs font-mono tabular-nums border transition-colors duration-(--dur-1)',
                  measure === m
                    ? 'bg-primary text-primary-foreground border-transparent'
                    : 'bg-background text-foreground border-border hover:bg-muted'
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
