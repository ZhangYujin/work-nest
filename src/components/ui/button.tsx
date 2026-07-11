import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
          variant === 'default' && 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
          variant === 'outline' && 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
          variant === 'ghost' && 'hover:bg-accent hover:text-accent-foreground',
          variant === 'destructive' && 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
          variant === 'secondary' && 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
          size === 'sm' && 'h-8 px-3 text-xs',
          size === 'md' && 'h-9 px-4',
          size === 'lg' && 'h-10 px-6',
          size === 'icon' && 'h-9 w-9',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
