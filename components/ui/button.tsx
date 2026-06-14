'use client'

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { AnimatePresence, motion } from "motion/react"

import { cn } from "@/lib/utils"
import { swapFade } from "@/lib/motion"

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // Soft, state-colored "status" look. Orthogonal to `variant`; when set it
      // fully specifies border/bg/text so it wins over the variant via twMerge.
      // Mirrors the StatusBadge palette. Keep these as complete static strings
      // for the Tailwind v4 scanner — never concatenate.
      tone: {
        none: "",
        active:
          "border border-green-500 bg-green-500/10 text-green-500 shadow-none hover:bg-green-500/15",
        inactive:
          "border border-red-500 bg-red-500/10 text-red-500 shadow-none hover:bg-red-500/15",
        warning:
          "border border-amber-500 bg-amber-500/10 text-amber-500 shadow-none hover:bg-amber-500/15",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      tone: "none",
      size: "default",
    },
  }
)

/** Material-style ripple — appended as an absolutely-positioned child, clipped by
 * the button's `overflow-hidden`. The `.ripple` / @keyframes live in globals.css. */
function createRipple(event: React.MouseEvent<HTMLButtonElement>) {
  const button = event.currentTarget
  const circle = document.createElement("span")
  const diameter = Math.max(button.clientWidth, button.clientHeight)
  const radius = diameter / 2
  const rect = button.getBoundingClientRect()
  circle.style.width = circle.style.height = `${diameter}px`
  circle.style.left = `${event.clientX - rect.left - radius}px`
  circle.style.top = `${event.clientY - rect.top - radius}px`
  circle.classList.add("ripple")
  const existing = button.getElementsByClassName("ripple")[0]
  if (existing) existing.remove()
  button.appendChild(circle)
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Processing state: shows a spinner, disables the button, sets aria-busy. */
  pending?: boolean
  /** Optional label shown while `pending` (defaults to the normal children). */
  pendingText?: React.ReactNode
  /** Material ripple on click. */
  ripple?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      tone,
      size,
      asChild = false,
      pending = false,
      pendingText,
      ripple = false,
      disabled,
      onClick,
      children,
      ...props
    },
    ref
  ) => {
    // Slot accepts a single child only, so skip the pending/ripple decoration
    // for asChild buttons (these are links — they never have a pending state).
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, tone, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      )
    }

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (ripple && !disabled && !pending) createRipple(e)
      onClick?.(e)
    }

    return (
      <button
        className={cn(buttonVariants({ variant, tone, size, className }))}
        ref={ref}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        onClick={handleClick}
        {...props}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={pending ? "pending" : "content"}
            variants={swapFade}
            initial="hidden"
            animate="show"
            exit="exit"
            className="relative z-10 inline-flex items-center gap-2"
          >
            {pending ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" />
                {pendingText ?? children}
              </>
            ) : (
              children
            )}
          </motion.span>
        </AnimatePresence>
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
