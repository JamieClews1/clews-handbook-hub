// Imported first in main.tsx so the guard is in place before the sign-in client is created.
import { startAuthLockGuard } from "./auth-lock-guard";

startAuthLockGuard();
