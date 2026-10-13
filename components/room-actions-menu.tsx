"use client";
import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import type { RoomAction, RoomActionId } from "@/lib/room-actions";
export function RoomActionsMenu({
  roomNumber,
  actions,
  onAction,
  disabled = false,
}: {
  roomNumber: string;
  actions: RoomAction[];
  onAction: (id: RoomActionId) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = useRef<RoomActionId | null>(null);
  if (!actions.length) return null;
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="min-h-11 shrink-0 gap-1 px-2 text-xs"
          aria-label={`Mais ações do quarto ${roomNumber}`}
        >
          Mais ações
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        collisionPadding={12}
        className="w-64 max-w-[calc(100vw-24px)]"
        onCloseAutoFocus={(event) => {
          const action = selected.current;
          if (action) {
            event.preventDefault();
            selected.current = null;
            onAction(action);
          }
        }}
      >
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.id}
            disabled={!action.enabled}
            className="min-h-11 flex-col items-start justify-center gap-0.5"
            onSelect={() => {
              selected.current = action.id;
              setOpen(false);
            }}
          >
            <span>{action.label}</span>
            {action.reason && (
              <span className="text-xs text-muted-foreground">
                {action.reason}
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
