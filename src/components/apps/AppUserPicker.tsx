import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface AppUserProfile {
  id: string;
  full_name: string | null;
  email: string;
  user_types: string[] | null;
}

interface AppUserPickerProps {
  /** Currently linked profile id, if any. */
  value: string | null;
  /** Fallback display name when no user_id is linked (legacy free-text records). */
  fallbackLabel?: string;
  /** Restrict the list to users that have this user type (e.g. "driver", "yard"). */
  userType?: string;
  onSelect: (profile: AppUserProfile) => void;
  placeholder?: string;
}

/** Derive a sensible default app username from an email address. */
export const usernameFromEmail = (email: string) =>
  (email.split("@")[0] || "").trim();

/**
 * Searchable picker that lists existing platform users (profiles) so app staff
 * can be drawn from real accounts rather than typed in by hand.
 */
export const AppUserPicker = ({
  value,
  fallbackLabel,
  userType,
  onSelect,
  placeholder = "Select a user…",
}: AppUserPickerProps) => {
  const [open, setOpen] = useState(false);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["app-user-picker-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, user_types")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data as AppUserProfile[];
    },
  });

  const options = useMemo(() => {
    const list = userType
      ? profiles.filter((p) => (p.user_types ?? []).includes(userType as never))
      : profiles;
    return [...list].sort((a, b) =>
      (a.full_name || a.email).localeCompare(b.full_name || b.email),
    );
  }, [profiles, userType]);

  const selected = profiles.find((p) => p.id === value) || null;
  const label = selected
    ? selected.full_name || selected.email
    : fallbackLabel || "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate flex items-center gap-2", !label && "text-muted-foreground")}>
            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {label || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search users…" />
          <CommandList>
            <CommandEmpty>{isLoading ? "Loading users…" : "No users found."}</CommandEmpty>
            <CommandGroup>
              {options.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.full_name || ""} ${p.email}`}
                  onSelect={() => {
                    onSelect(p);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")}
                  />
                  <div className="flex flex-col">
                    <span>{p.full_name || p.email}</span>
                    <span className="text-xs text-muted-foreground">{p.email}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
