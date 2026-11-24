// One write from the app: in demo it only changes memory; for real it calls GitHub, then reloads.
import { AuthError, WriteError } from './github.js';

/** {error: string|null, auth: boolean}; `auth` means the token was refused (go to the settings). */
export async function runWrite({ demo, demoChange, realWrite, reload }) {
  if (demo) {
    demoChange();
    return { error: null, auth: false };
  }
  try {
    await realWrite();
  } catch (e) {
    if (e instanceof AuthError) return { error: null, auth: true };
    if (e instanceof WriteError) return { error: `${e.message} (GitHub a répondu ${e.status}).`, auth: false };
    return { error: `Envoi impossible : ${e.message}`, auth: false };
  }
  await reload();
  return { error: null, auth: false };
}
