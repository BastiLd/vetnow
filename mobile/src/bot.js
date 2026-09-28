/* VetNow v3 — Bot 3.0 aus dem gemeinsamen Kern (Kopie in src/shared, erzeugt mit „npm run sync:shared").
   Alte Import-Namen bleiben, damit die Screens unverändert funktionieren. */
import { botConversationReply as reply, botGreeting, botImageReply as imageReply } from './shared/bot/index.js';

export function botConversationReply(opts) { return reply(opts); }
export function botGreetingText(fromRole, practiceName) { return botGreeting(fromRole, practiceName); }
export function botImageReply(fromRole, caption) { return imageReply(fromRole, caption); }
