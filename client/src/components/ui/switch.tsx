import * as React from "react";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <div className="inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary">
      <input
        type="checkbox"
        className={cn(
          "peer h-[20px] w-[20px] rounded-full border-2 border-transparent bg-background ring-offset-background transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
          className
        )}
        ref={ref}
        {...props}
      />
    </div>
  )
);
Switch.displayName = "Switch";

export { Switch };