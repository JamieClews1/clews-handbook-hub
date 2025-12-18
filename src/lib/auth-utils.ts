// Convert username to internal email format
export const EMAIL_DOMAIN = "clewsrecycling.co.uk";

export const usernameToEmail = (username: string): string => {
  // Remove any whitespace and convert to lowercase
  const cleanUsername = username.trim().toLowerCase();
  return `${cleanUsername}@${EMAIL_DOMAIN}`;
};

export const emailToUsername = (email: string): string => {
  // Extract username from internal email format
  return email.replace(`@${EMAIL_DOMAIN}`, "");
};
