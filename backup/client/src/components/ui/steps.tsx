import * as React from "react"
import { cn } from "@/lib/utils"

const StepsContext = React.createContext<{
  activeStep?: string
  orientation?: "vertical" | "horizontal"
}>({
  activeStep: undefined,
  orientation: "vertical",
})

const Steps = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    activeStep?: string
    orientation?: "vertical" | "horizontal"
  }
>(({ activeStep, orientation = "vertical", className, children, ...props }, ref) => {
  return (
    <StepsContext.Provider value={{ activeStep, orientation }}>
      <div
        ref={ref}
        className={cn(
          "flex gap-4",
          orientation === "vertical" ? "flex-col" : "flex-row",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </StepsContext.Provider>
  )
})
Steps.displayName = "Steps"

const StepContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    value: string
  }
>(({ value, className, children, ...props }, ref) => {
  const { orientation } = React.useContext(StepsContext)
  return (
    <div
      ref={ref}
      className={cn(
        "flex",
        orientation === "vertical" ? "flex-col gap-2" : "gap-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
StepContent.displayName = "StepContent"

const StepHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { orientation } = React.useContext(StepsContext)
  return (
    <div
      ref={ref}
      className={cn(
        "flex",
        orientation === "vertical" ? "flex-row gap-2 py-2" : "flex-col items-center",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
StepHeader.displayName = "StepHeader"

const StepIndicator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { orientation } = React.useContext(StepsContext)
  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-8 w-8 items-center justify-center rounded-full border bg-background",
        orientation === "vertical" ? "mt-0.5" : "",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
StepIndicator.displayName = "StepIndicator"

const StepTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-medium", className)}
    {...props}
  />
))
StepTitle.displayName = "StepTitle"

const StepDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
StepDescription.displayName = "StepDescription"

const StepTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    value: string
  }
>(({ value, className, children, ...props }, ref) => {
  const { activeStep } = React.useContext(StepsContext)
  return (
    <button
      ref={ref}
      className={cn(
        "flex w-full items-start gap-2 rounded-md border border-transparent p-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        activeStep === value && "border-border",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
})
StepTrigger.displayName = "StepTrigger"

export {
  Steps,
  StepContent,
  StepHeader,
  StepIndicator,
  StepTitle,
  StepDescription,
  StepTrigger,
}