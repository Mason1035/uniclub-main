import { buttonVariants } from "./button-variants"
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { type VariantProps } from "class-variance-authority"
import "../../styles/ui-motion.css"

import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingLabel?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, loadingLabel, disabled, children, onClickCapture, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
        disabled={disabled || loading}
        aria-busy={loading || props["aria-busy"]}
        aria-disabled={asChild && (disabled || loading) ? true : props["aria-disabled"]}
        aria-label={loading && loadingLabel ? loadingLabel : props["aria-label"]}
        data-loading={loading ? "true" : undefined}
        data-as-child={asChild ? "true" : undefined}
        onClickCapture={event => {
          // Slot children may be links: keep their markup and suppress activation while busy.
          if (loading || asChild && disabled) {
            event.preventDefault()
            event.stopPropagation()
            return
          }
          onClickCapture?.(event)
        }}
      >
        {asChild ? children : <span className="ui-button-content">
          <span className="ui-button-label">{children}</span>
          <span className="ui-button-pending" aria-hidden="true">
            <span className="ui-button-spinner" />
            {loadingLabel && size !== "icon" && <span>{loadingLabel}</span>}
          </span>
        </span>}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button }
