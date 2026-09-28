/* VetNow v3 — Bot 3.0 kommt jetzt aus dem gemeinsamen Kern (vetnow-app/shared/bot).
   Diese Datei hält nur die alten Import-Namen am Leben, damit die bestehenden Screens unverändert bleiben.
   Neu in Bot 3.0: Sicherheits-Triage vor allem anderen (Notfälle/Gifte), Tippfehler & Dialekt,
   Verneinung, Termin-Gedächtnis, Kolleg:innen-Persona – geprüft mit über 380 Testfällen. */
import { botConversationReply as reply, botGreeting, botImageReply as imageReply } from '../../shared/bot/index.js';

export function botConversationReply(opts) { return reply(opts); }
export function botGreetingText(fromRole, practiceName) { return botGreeting(fromRole, practiceName); }
export function botImageReply(fromRole, caption) { return imageReply(fromRole, caption); }
