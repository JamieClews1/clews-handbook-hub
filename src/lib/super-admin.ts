// Super admins have unrestricted access — including seeing sections
// hidden via the Section Visibility CMS.
// Update this list if additional super admins are needed.
export const SUPER_ADMIN_EMAILS = [
  "jamie@clewsrecycling.co.uk",
  "jclewsie@gmail.com",
];

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}
