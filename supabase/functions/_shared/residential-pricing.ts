export const PERSONAL_EMAIL_DOMAIN = /^(gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|icloud|me|mac|aol|btinternet|btopenworld|sky|talktalk|virginmedia|ntlworld|blueyonder|tiscali|plusnet|protonmail|proton|gmx|mail)\./i;

export function isResidentialEnquiry(input: { email?: string | null; text: string; subject?: string | null; website?: boolean; company?: string | null; customerId?: string | null; contract?: string | null }): boolean {
  const text = `${input.subject ?? ''} ${input.text}`;
  const website = input.website || /website enquiry|website inquiry|web(?:site)? (?:contact|enquiry) form|new (?:submission|enquiry) from.*(?:website|contact form)|quote enquiry[\s\S]*customer[\s\S]*job details[\s\S]*skip size:/i.test(text);
  if (website) return true;
  const business = !!(input.company || input.customerId || input.contract) || /\b(ltd|limited|plc|llp|company|business|trading|warehouse|industrial|construction|builders?|contractors?|reconomy|biffa|papilo|allwood|project\s*waste|kenny|go\s*green|suez)\b/i.test(text);
  if (business) return false;
  const email = input.email || text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  const domain = email.split('@')[1] ?? '';
  return PERSONAL_EMAIL_DOMAIN.test(domain) || /\b(my house|my home|domestic|garden clearance|my driveway)\b/i.test(text);
}

export function quoteTotals(price: number, vatInclusive: boolean, surchargeNet: number) {
  const net = vatInclusive ? price / 1.2 : price;
  const totalNet = net + surchargeNet;
  return { net, totalNet, vat: totalNet * 0.2, gross: totalNet * 1.2 };
}

export function residentialRowMatches(label: string, size: number | null, waste: string): boolean {
  if (size == null || !new RegExp(`\\b${size}\\b`).test(label)) return false;
  const material = waste === 'inert' ? /inert|hardcore/i : waste === 'green' ? /green/i : waste === 'wood' ? /wood/i : waste === 'general' ? /mixed waste/i : null;
  return !!material?.test(label);
}