import * as React from "react"
import { type DialogProps } from "@radix-ui/react-dialog"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"

type CommandContextValue = {
  search: string
  setSearch: (value: string) => void
}

const CommandContext = React.createContext<CommandContextValue | undefined>(
  undefined,
)

function useCommandContext(component: string) {
  const context = React.useContext(CommandContext)
  if (!context) {
    throw new Error(`${component} must be used within a <Command />`)
  }
  return context
}

type CommandListContextValue = {
  setItemVisibility: (id: string, visible: boolean) => void
  removeItem: (id: string) => void
  visibleCount: number
}

const CommandListContext = React.createContext<CommandListContextValue | undefined>(
  undefined,
)

function useCommandListContext() {
  return React.useContext(CommandListContext)
}

const Command = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const [search, setSearch] = React.useState("")
  const value = React.useMemo(() => ({ search, setSearch }), [search])

  return (
    <CommandContext.Provider value={value}>
      <div
        ref={ref}
        className={cn(
          "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </CommandContext.Provider>
  )
})
Command.displayName = "Command"

interface CommandDialogProps extends DialogProps {}

const CommandDialog = ({ children, ...props }: CommandDialogProps) => {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

const CommandInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, value, onChange, ...props }, ref) => {
  const { search, setSearch } = useCommandContext("CommandInput")
  const isControlled = value !== undefined
  const inputValue = isControlled ? value : search

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) {
      setSearch(event.target.value)
    }
    onChange?.(event)
  }

  return (
    <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
      <input
        ref={ref}
        value={inputValue}
        onChange={handleChange}
        className={cn(
          "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  )
})
CommandInput.displayName = "CommandInput"

const CommandList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const [visibilityMap, setVisibilityMap] = React.useState<Record<string, boolean>>({})

  const setItemVisibility = React.useCallback((id: string, visible: boolean) => {
    setVisibilityMap((prev) => {
      if (prev[id] === visible) return prev
      return { ...prev, [id]: visible }
    })
  }, [])

  const removeItem = React.useCallback((id: string) => {
    setVisibilityMap((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const visibleCount = React.useMemo(
    () => Object.values(visibilityMap).filter(Boolean).length,
    [visibilityMap],
  )

  const contextValue = React.useMemo(
    () => ({ setItemVisibility, removeItem, visibleCount }),
    [setItemVisibility, removeItem, visibleCount],
  )

  return (
    <CommandListContext.Provider value={contextValue}>
      <div
        ref={ref}
        role="listbox"
        className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
        {...props}
      >
        {children}
      </div>
    </CommandListContext.Provider>
  )
})
CommandList.displayName = "CommandList"

const CommandEmpty = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const listContext = useCommandListContext()
  if (listContext && listContext.visibleCount > 0) {
    return null
  }
  return (
    <div ref={ref} className="py-6 text-center text-sm" {...props} />
  )
})
CommandEmpty.displayName = "CommandEmpty"

const CommandGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { heading?: React.ReactNode }
>(({ className, children, heading, ...props }, ref) => {
  return (
    <div
      ref={ref}
      role="group"
      cmdk-group=""
      className={cn(
        "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
        className,
      )}
      {...props}
    >
      {heading ? (
        <div cmdk-group-heading="" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {heading}
        </div>
      ) : null}
      {children}
    </div>
  )
})
CommandGroup.displayName = "CommandGroup"

const CommandSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="separator"
    cmdk-separator=""
    className={cn("-mx-1 h-px bg-border", className)}
    {...props}
  />
))
CommandSeparator.displayName = "CommandSeparator"

interface CommandItemProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onSelect"> {
  value?: string
  onSelect?: (value: string) => void
}

function getNodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map((child) => getNodeText(child)).join(" ")
  }
  if (React.isValidElement(node)) {
    return getNodeText(node.props.children)
  }
  return ""
}

const CommandItem = React.forwardRef<HTMLButtonElement, CommandItemProps>(
  ({ className, children, value, onSelect, onClick, ...props }, ref) => {
    const { search } = useCommandContext("CommandItem")
    const listContext = useCommandListContext()
    const id = React.useId()

    const textValue = React.useMemo(() => {
      const resolved = value ?? getNodeText(children)
      return resolved.trim()
    }, [children, value])

    const matches = React.useMemo(() => {
      if (!search) return true
      return textValue.toLowerCase().includes(search.toLowerCase())
    }, [search, textValue])

    React.useEffect(() => {
      if (!listContext) return
      listContext.setItemVisibility(id, matches)
      return () => {
        listContext.removeItem(id)
      }
    }, [id, listContext, matches])

    const handleClick = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      onClick?.(event)
      if (!event.defaultPrevented) {
        onSelect?.(value ?? textValue)
      }
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      props.onKeyDown?.(event)
      if (event.defaultPrevented) return
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        onSelect?.(value ?? textValue)
      }
    }

    return (
      <button
        type="button"
        ref={ref}
        cmdk-item=""
        data-selected="false"
        className={cn(
          "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected='true']:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50",
          !matches && "hidden",
          className,
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {children}
      </button>
    )
  },
)
CommandItem.displayName = "CommandItem"

const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      cmdk-shortcut=""
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}
CommandShortcut.displayName = "CommandShortcut"

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
