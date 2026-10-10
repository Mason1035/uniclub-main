import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"
import "./tabs.css"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, forwardedRef) => {
  const [list, setList] = React.useState<React.ElementRef<typeof TabsPrimitive.List> | null>(null)
  const setRef = React.useCallback((node: React.ElementRef<typeof TabsPrimitive.List> | null) => {
    setList(node)
    if (typeof forwardedRef === "function") forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }, [forwardedRef])

  React.useLayoutEffect(() => {
    if (!list) return
    let frame = 0
    let armFrame = 0
    let disposed = false

    const ownedTabs = () => Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]'))
      .filter(tab => tab.closest('[role="tablist"]') === list)

    const measure = () => {
      frame = 0
      const active = ownedTabs().find(tab => tab.dataset.state === "active")
      if (!active || !list.offsetWidth || !list.offsetHeight || !active.offsetWidth || !active.offsetHeight) {
        list.removeAttribute("data-indicator-ready")
        return
      }

      // Measure only on selection, content, or size changes. Convert viewport
      // coordinates back to local coordinates if an ancestor is scaled.
      const listRect = list.getBoundingClientRect()
      const tabRect = active.getBoundingClientRect()
      const scaleX = listRect.width / list.offsetWidth || 1
      const scaleY = listRect.height / list.offsetHeight || 1
      list.style.setProperty("--tabs-indicator-x", `${(tabRect.left - listRect.left) / scaleX + list.scrollLeft - list.clientLeft}px`)
      list.style.setProperty("--tabs-indicator-y", `${(tabRect.top - listRect.top) / scaleY + list.scrollTop - list.clientTop}px`)
      list.style.setProperty("--tabs-indicator-width", `${tabRect.width / scaleX}px`)
      list.style.setProperty("--tabs-indicator-height", `${tabRect.height / scaleY}px`)
      list.dataset.indicatorReady = "true"
    }

    const schedule = () => {
      if (!disposed && !frame) frame = window.requestAnimationFrame(measure)
    }
    const resize = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule)
    const observeSizes = () => {
      resize?.disconnect()
      resize?.observe(list)
      ownedTabs().forEach(tab => resize?.observe(tab))
    }
    const mutations = new MutationObserver(records => {
      if (records.some(record => record.type === "childList")) observeSizes()
      schedule()
    })

    observeSizes()
    measure()
    // The initial selected tab should be placed immediately, not fly in from
    // the list origin. Only later state changes receive a transition.
    armFrame = window.requestAnimationFrame(() => { list.dataset.indicatorAnimated = "true" })
    // Restrict attributes to Radix state; our own CSS variables and readiness
    // marker never feed back into this observer.
    mutations.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state", "data-orientation"] })
    window.addEventListener("resize", schedule)
    document.fonts?.ready.then(schedule)

    return () => {
      disposed = true
      if (frame) window.cancelAnimationFrame(frame)
      if (armFrame) window.cancelAnimationFrame(armFrame)
      mutations.disconnect()
      resize?.disconnect()
      window.removeEventListener("resize", schedule)
      list.removeAttribute("data-indicator-ready")
      list.removeAttribute("data-indicator-animated")
      for (const property of ["x", "y", "width", "height"]) list.style.removeProperty(`--tabs-indicator-${property}`)
    }
  }, [list])

  return (
    <TabsPrimitive.List
      ref={setRef}
      className={cn(
        "classhub-tabs-list inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props}
    />
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "classhub-tabs-trigger inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
