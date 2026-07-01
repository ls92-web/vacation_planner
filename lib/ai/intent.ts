"use client";

// ===== Chat intent detection =====
// Every message is classified BEFORE it reaches the LLM. Conversational and
// meaningless messages get instant, token-free replies; only real planning
// intent is sent to the model. Keeps the companion feeling fast + human and
// avoids wasting AI tokens (and the "AI busy" path) on "hi" / "asdf".

export type Intent =
  | "empty"
  | "greeting"
  | "farewell"
  | "thanks"
  | "confirmation"
  | "destination"
  | "planning"
  | "followup"
  | "gibberish"
  | "general";

const GREET = /^(hi+|hey+|hello+|yo|hiya|heya|howdy|sup|hola|gm|good\s?(morning|afternoon|evening|day))\b/i;
const BYE = /^(bye+|goodbye|see\s?(you|ya)|later|cya|ttyl|good\s?night|farewell|take\s?care|i'?m\s?off)\b/i;
const THANK = /^(thanks?|thank\s?(you|u)|thx|ty|cheers|appreciate|much\s?appreciated)\b/i;
const CONFIRM = /^(y(es|ep|up|eah)?|n(o|ope|ah)|sure|ok(ay)?|correct|right|sounds?\s?good|go\s?ahead|do\s?it|please\s?do|absolutely|definitely|perfect)\b[.! ]*$/i;
const PLAN = /\b(plan|itinerar|trip|days?|nights?|weekend|week|visit|travel|tour|road\s?trip|honeymoon|holiday|vacation|schedule|explore|stay|hotel|restaurant|eat|see|do)\b/i;
const QUESTION = /\?\s*$|^(what|where|when|which|how|why|can|could|should|would|do|does|is|are|any|recommend|suggest|tell)\b/i;

const KB = ["qwer", "wert", "erty", "rtyu", "tyui", "asdf", "sdfg", "dfgh", "fghj", "ghjk", "hjkl", "zxcv", "xcvb", "cvbn", "vbnm", "lkjh", "poiu", "iuyt", "qazwsx", "qwerty"];
const VOWEL = /[aeiouyà-ÿ]/i;

/** Does this token resemble a real word / place name (vs keyboard mashing)? */
function wordLike(w: string): boolean {
  const t = w.toLowerCase().replace(/[^a-zà-ÿ]/g, "");
  if (t.length <= 2) return true;                                  // "LA", "hi" — too short to judge
  if (!VOWEL.test(t)) return false;                               // no vowel at all → "sdklf"
  if (/[bcdfghjklmnpqrstvwxz]{4,}/.test(t)) return false;         // 4+ consonant run → "asdkfj"
  const vowels = (t.match(/[aeiouyà-ÿ]/gi) || []).length;
  return vowels / t.length >= 0.2;                                // too few vowels → mashing
}

/** Keyboard mashing / random characters — clearly not a real message. */
function isGibberish(raw: string): boolean {
  const t = raw.trim();
  const compact = t.replace(/\s+/g, "");
  if (compact.length < 2) return false;
  if (/^(.)\1{3,}$/.test(compact)) return true;                    // "aaaa", "!!!!"
  if (/^[\d\W_]+$/.test(compact) && compact.length >= 4) return true; // "123123", "...."
  const low = compact.toLowerCase();
  if (KB.some((k) => low.includes(k))) return true;                // keyboard runs
  // No token looks like a real word → treat the whole thing as mashing.
  const tokens = t.split(/\s+/).filter(Boolean);
  if (tokens.length && !tokens.some(wordLike)) return true;
  // A single long run of letters with awkward consonant clustering is mashing
  // (e.g. "okkesdijdsuheujd") — even when it happens to contain enough vowels.
  if (tokens.length === 1) {
    const w = low.replace(/[^a-zà-ÿ]/g, "");
    if (w.length >= 12 && /[bcdfghjklmnpqrstvwxz]{3,}/.test(w)) return true;
  }
  return false;
}

export function classifyIntent(raw: string): Intent {
  const t = (raw || "").trim();
  if (!t) return "empty";
  if (isGibberish(t)) return "gibberish";
  if (GREET.test(t)) return "greeting";
  if (BYE.test(t)) return "farewell";
  if (THANK.test(t)) return "thanks";
  if (CONFIRM.test(t)) return "confirmation";
  if (PLAN.test(t)) return "planning";
  if (QUESTION.test(t)) return "followup";
  // A short, letter-y phrase with a vowel and no command words → a place name.
  const words = t.split(/\s+/);
  if (words.length <= 4 && /^[a-zà-ÿ .,'’-]+$/i.test(t) && /[aeiou]/i.test(t)) return "destination";
  return "general";
}

/** Intents we answer instantly, without ever calling the model. */
export function isInstantIntent(intent: Intent): boolean {
  return intent === "greeting" || intent === "farewell" || intent === "thanks" || intent === "gibberish";
}

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

// Lightweight cache: a repeated greeting/thanks returns the same reply, no work.
const cache = new Map<string, string>();

const POOLS: Record<string, { withPlan: string[]; noPlan: string[] }> = {
  greeting: {
    noPlan: [
      "Hey! Tell me where you'd like to go and I'll start shaping {t}.",
      "Hi there! Name a city or two and I'll build the trip around them.",
      "Hello! Ready when you are — where shall we go?",
    ],
    withPlan: [
      "Hey! Want me to refine {t} — tweak a day, add a stop, or find a hidden gem?",
      "Hi there! {t} is taking shape. Ask me anything, or say “plan my days”.",
      "Hello again! Where shall we take {t} next?",
    ],
  },
  thanks: {
    noPlan: ["Anytime! So — where are we headed?", "My pleasure. Tell me a destination and we'll begin.", "Happy to help! Where would you like to go?"],
    withPlan: ["Anytime! Want a hidden gem or a tidy-up of a busy day?", "My pleasure — shall I suggest something else for the trip?", "Glad to help! Tell me what's next for {t}."],
  },
  farewell: {
    noPlan: ["Safe travels — I'll be right here when you're ready to plan.", "See you soon! Come back anytime to start your journey.", "Bye for now — your companion's always here."],
    withPlan: ["Safe travels — I'll keep {t} right here for when you're back.", "See you soon! Your plan is saved and waiting.", "Bye for now — ping me anytime to pick up planning."],
  },
  gibberish: {
    noPlan: ["I couldn't quite understand that. Tell me where you'd like to travel, ask for recommendations, or let me help plan your itinerary."],
    withPlan: ["I couldn't quite understand that. Tell me where you'd like to travel, ask for recommendations, or let me help plan your itinerary."],
  },
};

/** An instant, human reply for a conversational/meaningless message — cached + varied. */
export function instantReply(intent: Intent, ctx: { tripName?: string; hasPlan?: boolean }, key: string): string {
  const trip = ctx.tripName || "your trip";
  const cacheKey = `${intent}|${key}|${trip}|${ctx.hasPlan ? 1 : 0}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const pool = POOLS[intent] ?? POOLS.gibberish;
  const arr = ctx.hasPlan ? pool.withPlan : pool.noPlan;
  const reply = arr[hash(key) % arr.length].replace(/\{t\}/g, trip);
  cache.set(cacheKey, reply);
  return reply;
}
