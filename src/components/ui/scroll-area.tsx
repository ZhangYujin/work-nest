import { cn } from '../../lib/utils';
import { HTMLAttributes, forwardRef } from 'react';

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {}

const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative overflow-auto',
          'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted scrollbar-thumb-rounded-full',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ScrollArea.displayName = 'ScrollArea';

export { ScrollArea };
