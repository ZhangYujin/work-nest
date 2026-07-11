import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
          variant === 'default' && 'bg-primary text-primary-foreground',
          variant === 'secondary' && 'bg-secondary text-secondary-foreground',
          variant === 'destructive' && 'bg-destructive text-destructive-foreground',
          variant === 'outline' && 'border border-input text-foreground',
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
