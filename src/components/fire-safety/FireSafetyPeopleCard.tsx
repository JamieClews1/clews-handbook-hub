import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import { FIRE_ROLES, FirePerson, fireRoleLabel } from "@/lib/fire-safety";

/**
 * Read-only view of the fire safety responsible people register.
 * Used inside H&S documents (site inductions, fire safety) so names are
 * maintained in one place only.
 */
const FireSafetyPeopleCard = ({ title = "Responsible people and fire wardens" }: { title?: string }) => {
  const [people, setPeople] = useState<FirePerson[]>([]);

  useEffect(() => {
    supabase
      .from("fire_safety_people")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setPeople((data as FirePerson[]) || []));
  }, []);

  if (people.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-primary" /> {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Maintained in Fire Safety → People. Updating it there updates this list everywhere.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {FIRE_ROLES.filter((r) => people.some((p) => p.role === r.value)).map((role) => (
          <div key={role.value}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {role.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {people
                .filter((p) => p.role === role.value)
                .map((p) => (
                  <Badge key={p.id} variant="secondary" className="gap-1 px-2.5 py-1 text-sm font-normal">
                    {p.full_name}
                    {p.area ? <span className="text-muted-foreground">· {p.area}</span> : null}
                  </Badge>
                ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default FireSafetyPeopleCard;
