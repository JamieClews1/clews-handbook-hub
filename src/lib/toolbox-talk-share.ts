import type { ToolboxTalkSignature } from "./toolbox-talk-signatures";

/** Public read-and-sign page for a Toolbox Talk share link. */
export const TOOLBOX_TALK_SHARE_PATH = "/talk";

export const toolboxTalkShareUrl = (origin: string, token: string): string =>
  `${origin.replace(/\/+$/, "")}${TOOLBOX_TALK_SHARE_PATH}/${encodeURIComponent(token)}`;

export interface ToolboxTalkGuestSignature {
  id: string;
  signer_name: string;
  company_name: string | null;
  job_title: string | null;
  signed_at: string;
  signature_image: string | null;
}

/** How a link signer is named on screen and in the signature appendix. */
export const guestSignerLabel = (g: Pick<ToolboxTalkGuestSignature, "signer_name" | "company_name">): string => {
  const name = g.signer_name.trim() || "Unnamed";
  const company = g.company_name?.trim();
  return `${name}${company ? ` (${company})` : ""} - signed via link`;
};

/** Merge staff sign-offs and link signatures into one appendix list, oldest first. Nothing is inferred. */
export const mergeTalkSignatures = (
  staff: ToolboxTalkSignature[],
  guests: ToolboxTalkGuestSignature[],
): ToolboxTalkSignature[] =>
  [
    ...staff,
    ...guests.map((g) => ({
      id: g.id,
      user_id: "",
      signed_at: g.signed_at,
      signature_image: g.signature_image,
      name: guestSignerLabel(g),
    })),
  ].sort((a, b) => a.signed_at.localeCompare(b.signed_at) || a.id.localeCompare(b.id));
