import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  talkCoverage,
  type CoverageProfile,
  type CoverageSignature,
  type CoverageTalk,
  type GroupCoverage,
} from "@/lib/toolbox-talk-coverage";
import { cn } from "@/lib/utils";

interface Props {
  /** Published talks. */
  talks: CoverageTalk[];
  /** Current staff (archived and left staff are ignored by the maths). */
  profiles: CoverageProfile[];
  /** Every recorded sign-off. */
  signatures: CoverageSignature[];
}

function GroupBlock({ group }: { group: GroupCoverage }) {
  const complete = group.expected > 0 && group.pending === 0;
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{group.label}</p>
        <p className="text-[28px] font-bold leading-9 tabular-nums text-foreground">
          {group.expected === 0 ? "—" : `${group.completion}%`}
        </p>
      </div>
      <Progress
        value={group.completion}
        className={cn("mt-2 h-2", complete && "[&>div]:bg-success")}
        aria-label={`${group.label} signing progress`}
      />
      <p className="mt-2 text-sm text-muted-foreground tabular-nums">
        {group.expected === 0
          ? "No talks assigned yet"
          : `${group.signed} of ${group.expected} sign-offs recorded across ${group.talks} talk${group.talks === 1 ? "" : "s"}`}
      </p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {group.people === 0
          ? "No current staff to sign"
          : `${group.peopleUpToDate} of ${group.people} ${group.people === 1 ? "person" : "people"} have signed every talk`}
        {group.noTalks > 0 && ` · ${group.noTalks} with nothing to sign`}
      </p>
      {group.pendingMandatory > 0 && (
        <p className="mt-1 text-xs font-medium text-destructive tabular-nums">
          {group.pendingMandatory} mandatory sign-off{group.pendingMandatory === 1 ? "" : "s"} outstanding
        </p>
      )}
    </div>
  );
}

/** Quick view of how much of the signing each audience group still owes. */
export function ToolboxTalkCoverage({ talks, profiles, signatures }: Props) {
  const groups = talkCoverage(talks, profiles, signatures);
  const published = talks.length;

  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Signing progress
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {published} published talk{published === 1 ? "" : "s"}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map(group => (
            <GroupBlock key={group.type} group={group} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
