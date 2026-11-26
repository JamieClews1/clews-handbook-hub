import { AUDIENCE_LABELS, talkAppliesTo, type TalkListItem } from "@/lib/toolbox-talk-list";

/** A published talk, as stored. */
export type CoverageTalk = TalkListItem;

/** A staff profile; archived and left staff are ignored. */
export interface CoverageProfile {
  id: string;
  user_types?: string[] | null;
  is_archived?: boolean | null;
  left_at?: string | null;
}

/** One recorded sign-off. */
export interface CoverageSignature {
  user_id: string;
  toolbox_talk_id: string;
}

export interface GroupCoverage {
  /** User type key, e.g. "driver". */
  type: string;
  /** Display label, e.g. "Drivers". */
  label: string;
  /** Active staff in this group who have at least one talk to sign. */
  people: number;
  /** Of those, how many have signed every talk that applies to them. */
  peopleUpToDate: number;
  /** peopleUpToDate as a percentage of people (0 when nobody is expected to sign). */
  percent: number;
  /** Sign-off completion: signed as a percentage of expected (0 when nothing is expected). */
  completion: number;
  /** Talk sign-offs expected across the group (people x applicable talks). */
  expected: number;
  /** Of those, how many are recorded. */
  signed: number;
  /** Expected minus recorded. */
  pending: number;
  /** Outstanding sign-offs on mandatory talks. */
  pendingMandatory: number;
  /** Published talks that apply to this group. */
  talks: number;
  /** Active staff in the group with nothing to sign yet. */
  noTalks: number;
}

const isActive = (profile: CoverageProfile) =>
  !profile.is_archived && !profile.left_at;

/**
 * Signing coverage per audience group: how much of the work each group still
 * owes, counting only talks that actually apply to each person (by user type or
 * named assignment) and only staff who are still with the company.
 */
export function talkCoverage(
  talks: CoverageTalk[],
  profiles: CoverageProfile[],
  signatures: CoverageSignature[],
  groups: string[] = ["driver", "yard"],
): GroupCoverage[] {
  const signed = new Set(
    signatures.map(s => `${s.user_id}|${s.toolbox_talk_id}`),
  );
  const published = talks.filter(Boolean);

  return groups.map(type => {
    const groupTalks = published.filter(t => (t.user_types ?? []).includes(type));
    let people = 0;
    let peopleUpToDate = 0;
    let expected = 0;
    let done = 0;
    let pendingMandatory = 0;
    let noTalks = 0;

    for (const profile of profiles) {
      if (!isActive(profile)) continue;
      if (!(profile.user_types ?? []).includes(type)) continue;

      const applicable = published.filter(t =>
        talkAppliesTo(t, profile.id, profile.user_types ?? []),
      );
      if (applicable.length === 0) {
        noTalks += 1;
        continue;
      }

      people += 1;
      let outstanding = 0;
      for (const talk of applicable) {
        expected += 1;
        if (signed.has(`${profile.id}|${talk.id}`)) {
          done += 1;
        } else {
          outstanding += 1;
          if (talk.is_mandatory) pendingMandatory += 1;
        }
      }
      if (outstanding === 0) peopleUpToDate += 1;
    }

    return {
      type,
      label: AUDIENCE_LABELS[type] ?? type,
      people,
      peopleUpToDate,
      percent: people === 0 ? 0 : Math.round((peopleUpToDate / people) * 100),
      completion: expected === 0 ? 0 : Math.round((done / expected) * 100),
      expected,
      signed: done,
      pending: expected - done,
      pendingMandatory,
      talks: groupTalks.length,
      noTalks,
    };
  });
}
