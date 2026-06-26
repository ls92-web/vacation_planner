import type {
  AccomType,
  DayPlan,
  Destination,
  Place,
  ThemeName,
  TransportMode,
  TransportTemplate,
} from "./types";

// In production these become Supabase queries + OpenRouter completions + geocoding.
// Here they mirror the design prototype's mock data exactly.

export const THEMES: Record<ThemeName, { accent: string; accent2: string; bg: string; tint: string }> = {
  Ocean: { accent: "#16767e", accent2: "#e07a4f", bg: "#fbf7f0", tint: "#e9f3f1" },
  Sunset: { accent: "#c2614a", accent2: "#e0a458", bg: "#fdf5ee", tint: "#f8ebe1" },
  Forest: { accent: "#3f7a5a", accent2: "#cf9046", bg: "#f5f6ee", tint: "#e9f1e9" },
};

export const DESTINATION_SUGGESTIONS = [
  { name: "Barcelona, Spain", region: "Catalonia" },
  { name: "Barbados", region: "Caribbean" },
  { name: "Bari, Italy", region: "Puglia" },
  { name: "Bangkok, Thailand", region: "Asia" },
  { name: "Bali, Indonesia", region: "Indonesia" },
];

export const ALL_INTERESTS = [
  "Culture",
  "Kids",
  "Food",
  "Outdoors",
  "History",
  "Beaches",
  "Shopping",
  "Nightlife",
];

export const INITIAL_DESTINATIONS: Destination[] = [
  {
    id: 1,
    name: "Barcelona",
    country: "Spain",
    saved: true,
    expanded: true,
    arrive: "2026-07-14",
    depart: "2026-07-17",
    accoms: [
      {
        id: 11,
        type: "Hotel",
        name: "Hotel Casa Bonay",
        checkin: "2026-07-14",
        checkout: "2026-07-17",
        conf: "BCN-4471QX",
        address: "Gran Via de les Corts Catalanes 700",
        notes: "Family room booked · cot requested · late check-in OK.",
      },
    ],
  },
  {
    id: 2,
    name: "Costa Brava",
    country: "Spain",
    saved: true,
    expanded: false,
    arrive: "2026-07-17",
    depart: "2026-07-20",
    accoms: [
      {
        id: 21,
        type: "Airbnb",
        name: "Casa del Mar (sea-view villa)",
        checkin: "2026-07-17",
        checkout: "2026-07-20",
        conf: "",
        address: "Carrer de la Platja 8, Calella de Palafrugell",
        notes: "Private pool, 5 min walk to beach.",
      },
    ],
  },
];

export const ACCOM_TYPES: { k: AccomType; icon: string }[] = [
  { k: "Hotel", icon: "building" },
  { k: "Apartment", icon: "building2" },
  { k: "Airbnb", icon: "home" },
  { k: "Resort", icon: "umbrella" },
  { k: "Other", icon: "bed" },
];

export const MODE_ORDER: TransportMode[] = ["Drive", "Train", "Flight", "Ferry"];

export const MODE_TEMPLATES: Record<TransportMode, TransportTemplate> = {
  Drive: { duration: "2h 20m", cost: "~€60 fuel", distance: "180 km", scenic: 4, reason: "Door-to-door flexibility and the freedom to stop wherever you like." },
  Train: { duration: "3h 10m", cost: "from €39", distance: null, scenic: null, reason: "City-center to city-center with no airport transfers — easy with kids." },
  Flight: { duration: "1h 25m", cost: "from €55", distance: null, scenic: null, reason: "The fastest hop for a longer distance — book early for the best fare." },
  Ferry: { duration: "4h 30m", cost: "from €42", distance: null, scenic: 5, reason: "A relaxed open-water crossing if your stops sit along the coast." },
};

export const TRANSPORT_PAIRS: Record<string, TransportTemplate & { mode: TransportMode }> = {
  "barcelona|costa brava": {
    mode: "Drive",
    duration: "1h 40m",
    cost: "~€55 fuel",
    distance: "138 km",
    scenic: 5,
    reason: "A classic drive up the Costa Brava — quicker than transit and the cliffside coastal views are the highlight.",
  },
};

export const EX_CATEGORIES = [
  "All",
  "Attractions",
  "Restaurants",
  "Cafés",
  "Museums",
  "Nature",
  "Beaches",
  "Shopping",
  "Hidden Gems",
  "Family Activities",
  "Adventure",
  "Entertainment",
  "Historical Sites",
  "Scenic Views",
  "Nightlife",
];

export const SMART_FILTERS: { k: string; label: string }[] = [
  { k: "family", label: "Family Friendly" },
  { k: "kid", label: "Kid Friendly" },
  { k: "wheelchair", label: "Wheelchair Accessible" },
  { k: "indoor", label: "Indoor" },
  { k: "outdoor", label: "Outdoor" },
  { k: "free", label: "Free" },
  { k: "paid", label: "Paid" },
  { k: "open", label: "Open Now" },
  { k: "rated", label: "Highly Rated" },
  { k: "short", label: "Short Visit" },
  { k: "half", label: "Half-Day" },
  { k: "full", label: "Full-Day" },
  { k: "reservation", label: "Reservation Required" },
];

export const EX_THUMBS = [
  "linear-gradient(135deg,#6cae9e,#356b73)",
  "linear-gradient(135deg,#e0a458,#c2614a)",
  "linear-gradient(135deg,#7fa6d0,#3f5e8a)",
  "linear-gradient(135deg,#b58fc4,#7a5a9e)",
  "linear-gradient(135deg,#e08aa0,#b85572)",
  "linear-gradient(135deg,#8dbf9a,#5a8d6f)",
];

export const THUMBS = [
  "linear-gradient(150deg,#6cae9e,#3a7d72)",
  "linear-gradient(150deg,#e0a458,#c2614a)",
  "linear-gradient(150deg,#7fa6d0,#3f5e8a)",
  "linear-gradient(150deg,#b58fc4,#7a5a9e)",
  "linear-gradient(150deg,#e08aa0,#b85572)",
  "linear-gradient(150deg,#8dbf9a,#5a8d6f)",
];

export const PIN_COLORS = ["#16767e", "#e07a4f", "#7a5a9e", "#3f7a5a", "#c2614a", "#3f5e8a"];

export const PLACES: Place[] = [
  { id: "p1", name: "Sagrada Família", type: "attraction", cats: ["Attractions", "Historical Sites"], rating: 4.8, ai: 98, duration: "1.5–2 hr", price: "€26", hours: "9:00–18:00", dist: 0.6, travel: "8 min walk", mode: "walk", img: 0, desc: "Gaudí's unfinished basilica — a soaring, light-filled icon that defines the city skyline.", why: "Tops nearly every Barcelona list and sits a short walk from your hotel, so it is an easy, high-impact first stop.", family: "All ages · strollers welcome · lift to towers", best: "Right at opening, 9:00", nearby: ["Hospital de Sant Pau", "Av. Gaudí"], tags: ["family", "kid", "wheelchair", "indoor", "paid", "open", "rated", "half", "reservation"], x: "34%", y: "40%" },
  { id: "p2", name: "Park Güell", type: "attraction", cats: ["Attractions", "Nature", "Scenic Views"], rating: 4.7, ai: 95, duration: "2 hr", price: "€10", hours: "9:30–19:30", dist: 3.2, travel: "12 min drive", mode: "drive", img: 1, desc: "Mosaic terraces, gingerbread pavilions and sweeping views over the city and sea.", why: "Pairs Gaudí architecture with open running-around space — ideal with kids after an indoor morning.", family: "Great for kids · some steep paths", best: "Mid-afternoon, timed entry", nearby: ["Bunkers del Carmel", "Gràcia"], tags: ["family", "kid", "outdoor", "paid", "open", "rated", "half"], x: "40%", y: "18%" },
  { id: "p3", name: "La Boqueria Market", type: "attraction", cats: ["Shopping", "Attractions"], rating: 4.6, ai: 90, duration: "1 hr", price: "Free", hours: "8:00–20:30", dist: 1.8, travel: "9 min drive", mode: "drive", img: 2, desc: "A riot of color and aromas — fresh fruit, jamón, and juice stalls off La Rambla.", why: "Free, central and a fun sensory stop the kids will love just before lunch.", family: "Family friendly · busy at midday", best: "Late morning", nearby: ["Gothic Quarter", "La Rambla"], tags: ["family", "kid", "indoor", "free", "open", "rated", "short"], x: "52%", y: "52%" },
  { id: "p4", name: "Casa Batlló", type: "attraction", cats: ["Attractions", "Historical Sites"], rating: 4.7, ai: 92, duration: "1.5 hr", price: "€35", hours: "9:00–20:00", dist: 1.2, travel: "16 min walk", mode: "walk", img: 3, desc: "Gaudí's dragon-scaled facade and dreamlike interiors on the elegant Passeig de Gràcia.", why: "Indoor and air-conditioned — a perfect mid-afternoon break from the heat.", family: "Ages 6+ enjoy the audio tour", best: "Afternoon", nearby: ["Casa Milà", "Passeig de Gràcia"], tags: ["indoor", "paid", "open", "rated", "short"], x: "46%", y: "44%" },
  { id: "p5", name: "Bunkers del Carmel", type: "attraction", cats: ["Hidden Gems", "Scenic Views"], rating: 4.8, ai: 88, duration: "1 hr", price: "Free", hours: "Open 24h", dist: 2.1, travel: "13 min drive", mode: "drive", img: 4, desc: "Former civil-war bunkers turned into the best 360° sunset viewpoint in the city.", why: "A local favorite that most tour itineraries miss — unbeatable free sunset views.", family: "All ages · short uphill walk", best: "An hour before sunset", nearby: ["Park Güell", "El Carmel"], tags: ["free", "outdoor", "open", "rated", "short"], x: "38%", y: "12%" },
  { id: "p6", name: "Barceloneta Beach", type: "attraction", cats: ["Beaches", "Nature"], rating: 4.4, ai: 84, duration: "2 hr", price: "Free", hours: "Open 24h", dist: 2.8, travel: "14 min drive", mode: "drive", img: 5, desc: "The city beach — golden sand, boardwalk and paella terraces a step from the water.", why: "A relaxed way to end a busy day; the kids can swim while you unwind.", family: "Family favorite · lifeguards in summer", best: "Late afternoon", nearby: ["Aquàrium", "Port Vell"], tags: ["family", "kid", "outdoor", "free", "open", "half"], x: "66%", y: "70%" },
  { id: "p7", name: "Picasso Museum", type: "attraction", cats: ["Museums", "Historical Sites"], rating: 4.5, ai: 86, duration: "1.5 hr", price: "€12", hours: "10:00–19:00", dist: 1.5, travel: "18 min walk", mode: "walk", img: 0, closedMon: true, desc: "The world's most complete collection of Picasso's early work, in a medieval palace.", why: "Compact and manageable for families; under-18s enter free.", family: "Ages 8+ get the most from it", best: "Morning", nearby: ["Gothic Quarter", "El Born"], tags: ["indoor", "paid", "rated", "short"], x: "54%", y: "46%" },
  { id: "p8", name: "CosmoCaixa Science Museum", type: "attraction", cats: ["Family Activities", "Museums"], rating: 4.7, ai: 91, duration: "2 hr", price: "€6", hours: "10:00–20:00", dist: 4.0, travel: "17 min drive", mode: "drive", img: 1, desc: "A walk-through rainforest and dozens of hands-on exhibits kids can actually touch.", why: "The single most kid-friendly stop in the city — easily two happy hours.", family: "Built for ages 0–12", best: "Any time · fully indoor", nearby: ["Tibidabo", "Sarrià"], tags: ["family", "kid", "indoor", "paid", "wheelchair", "open", "half"], x: "30%", y: "24%" },
  { id: "p9", name: "Gothic Quarter", type: "attraction", cats: ["Historical Sites", "Attractions"], rating: 4.7, ai: 93, duration: "1.5 hr", price: "Free", hours: "Open 24h", dist: 0.3, travel: "4 min walk", mode: "walk", img: 2, desc: "A maze of medieval lanes, hidden squares and the cathedral cloister with its geese.", why: "Right beside your hotel and free — a gentle, shaded wander any time of day.", family: "All ages · flat & stroller-OK", best: "Morning or early evening", nearby: ["Barcelona Cathedral", "El Born"], tags: ["family", "kid", "outdoor", "free", "open"], x: "50%", y: "48%" },
  { id: "p10", name: "Tibidabo Amusement Park", type: "attraction", cats: ["Entertainment", "Adventure"], rating: 4.5, ai: 82, duration: "Half day", price: "€35", hours: "11:00–22:00", dist: 7.0, travel: "25 min drive", mode: "drive", img: 3, desc: "A century-old hilltop fairground with vintage rides and views over the whole city.", why: "A full afternoon of fun for the kids — best saved for a relaxed day.", family: "Ages 3+ · big day out", best: "Afternoon into evening", nearby: ["Tibidabo Church", "Collserola"], tags: ["family", "kid", "outdoor", "paid", "full"], x: "24%", y: "10%" },
  { id: "p11", name: "El Nacional", type: "restaurant", cats: ["Restaurants"], rating: 4.5, ai: 88, cuisine: "Spanish · Mediterranean", avgPrice: "€€", reservation: true, hours: "12:00–24:00", dist: 1.8, travel: "10 min drive", mode: "drive", img: 4, desc: "A grand food hall with four kitchens under one roof — something for every taste.", why: "Flexible options and space for the whole family between afternoon activities.", family: "Family friendly · high chairs", best: "Lunch or early dinner", nearby: ["Passeig de Gràcia"], tags: ["family", "kid", "indoor", "paid", "open", "reservation"], x: "48%", y: "42%" },
  { id: "p12", name: "La Paradeta", type: "restaurant", cats: ["Restaurants"], rating: 4.4, ai: 85, cuisine: "Seafood · Local", avgPrice: "€€", reservation: false, hours: "13:00–16:00", dist: 1.6, travel: "17 min walk", mode: "walk", img: 5, desc: "Point-and-pick fresh seafood sold by weight, then cooked to order — fun and casual.", why: "Kids love choosing their plate; quick and well-priced for a group.", family: "Family friendly · casual", best: "Early lunch to beat the queue", nearby: ["El Born", "Ciutadella"], tags: ["family", "kid", "indoor", "paid", "open", "short"], x: "58%", y: "52%" },
  { id: "p13", name: "Bo de B", type: "restaurant", cats: ["Restaurants", "Cafés"], rating: 4.7, ai: 80, cuisine: "Sandwiches · Quick", avgPrice: "€", reservation: false, hours: "12:00–22:00", dist: 1.4, travel: "16 min walk", mode: "walk", img: 0, desc: "Famous overstuffed sandwiches — cheap, fast and kid-approved. Grab-and-go.", why: "A budget-friendly, no-fuss lunch that fits neatly between two stops.", family: "Family friendly · grab & go", best: "Lunch", nearby: ["Gothic Quarter", "Barceloneta"], tags: ["family", "kid", "free", "open", "short"], x: "56%", y: "50%" },
  { id: "p14", name: "Brunch & Cake", type: "restaurant", cats: ["Cafés", "Restaurants"], rating: 4.3, ai: 78, cuisine: "Café · Brunch", avgPrice: "€€", reservation: false, hours: "9:00–18:00", dist: 2.0, travel: "11 min drive", mode: "drive", img: 1, desc: "Instagram-famous brunch spot with generous plates and great coffee.", why: "A leisurely late-morning start before a full day of sightseeing.", family: "Family friendly · kids menu", best: "Morning", nearby: ["Eixample"], tags: ["family", "indoor", "paid", "open", "short"], x: "44%", y: "38%" },
];

export const DAYS: DayPlan[] = [
  {
    day: "Day 1", date: "Mon, Jul 14", meta: "Gaudí & the heights", emoji: "landmark", title: "Architecture & big views",
    note: "Front-load the icons while everyone is fresh; downhill toward sunset.",
    stops: [
      { time: "09:00", title: "Sagrada Família", cat: "Landmark", kid: true, age: "All ages", hours: "9:00–18:00", duration: "2 hr", blurb: "Gaudí's basilica — book the first slot to beat the crowds and the heat. Strollers welcome.", dist: 0.6, mode: "Walk", travelTime: "8 min", x: "30%", y: "40%" },
      { time: "11:30", title: "Recinte Modernista Sant Pau", cat: "Architecture", kid: false, age: "7+", hours: "9:30–18:30", duration: "1 hr", blurb: "A calm, colorful campus a short walk away — shady courtyards for a breather.", dist: 1.8, mode: "Taxi", travelTime: "9 min", x: "40%", y: "30%" },
      { time: "13:00", title: "Lunch · El Nacional", cat: "Restaurant", kid: true, age: "All ages", hours: "12:00–24:00", duration: "1.5 hr", blurb: "A food hall with options for picky eaters and grown-ups alike. Easy with kids.", dist: 3.2, mode: "Metro", travelTime: "18 min", x: "55%", y: "52%" },
      { time: "15:30", title: "Park Güell", cat: "Park", kid: true, age: "All ages", hours: "9:30–19:30", duration: "2 hr", blurb: "Mosaics, terraces and running-around space. Timed entry — we slotted yours at 15:30.", dist: 2.1, mode: "Taxi", travelTime: "12 min", x: "38%", y: "18%" },
      { time: "18:00", title: "Bunkers del Carmel", cat: "Viewpoint", kid: true, age: "All ages", hours: "Open 24h", duration: "1 hr", blurb: "The best sunset panorama in the city. Bring water; it is a short uphill walk.", dist: 0, mode: "", travelTime: "", x: "30%", y: "12%" },
    ],
  },
  {
    day: "Day 2", date: "Tue, Jul 15", meta: "Animals, water & beach", emoji: "fish", title: "A full-on kids day",
    note: "Built for the 6 & 9 year-olds — animals in the morning, beach to finish.",
    stops: [
      { time: "09:30", title: "Barcelona Zoo", cat: "Wildlife", kid: true, age: "0–12 ★", hours: "10:00–18:00", duration: "2.5 hr", blurb: "Big shaded park with a petting area and playgrounds. Go early before it warms up.", dist: 0.5, mode: "Walk", travelTime: "6 min", x: "58%", y: "58%" },
      { time: "12:30", title: "Parc de la Ciutadella", cat: "Park", kid: true, age: "All ages", hours: "Open 24h", duration: "1 hr", blurb: "Rowboats on the lake and the big fountain — a gentle wander next to the zoo.", dist: 2.4, mode: "Metro", travelTime: "14 min", x: "62%", y: "52%" },
      { time: "14:00", title: "Lunch · La Paradeta", cat: "Restaurant", kid: true, age: "All ages", hours: "13:00–16:00", duration: "1.5 hr", blurb: "Point-and-pick seafood — fun for kids to choose. Can get busy, we timed it early.", dist: 1.6, mode: "Walk", travelTime: "17 min", x: "68%", y: "60%" },
      { time: "16:00", title: "L'Aquàrium de Barcelona", cat: "Aquarium", kid: true, age: "0–12 ★", hours: "10:00–20:00", duration: "2 hr", blurb: "Walk-through shark tunnel is the highlight. Indoors and air-conditioned — perfect mid-afternoon.", dist: 0.9, mode: "Walk", travelTime: "11 min", x: "74%", y: "66%" },
      { time: "18:30", title: "Barceloneta Beach", cat: "Beach", kid: true, age: "All ages", hours: "Open 24h", duration: "1.5 hr", blurb: "Wind down with a paddle and an ice cream as the day cools off.", dist: 0, mode: "", travelTime: "", x: "80%", y: "72%" },
    ],
  },
  {
    day: "Day 3", date: "Wed, Jul 16", meta: "Old town & science", emoji: "flask", title: "History, then hands-on",
    note: "A slower morning in the old town, then an afternoon the kids will love.",
    stops: [
      { time: "10:00", title: "Gothic Quarter walk", cat: "History", kid: true, age: "All ages", hours: "Open 24h", duration: "1.5 hr", blurb: "Wander the medieval lanes and hidden squares. Flat, shaded, stroller-OK.", dist: 0.3, mode: "Walk", travelTime: "4 min", x: "48%", y: "48%" },
      { time: "11:45", title: "Barcelona Cathedral", cat: "Landmark", kid: false, age: "6+", hours: "9:30–18:30", duration: "1 hr", blurb: "Step inside the cloister to see the resident geese — kids always love that bit.", dist: 1.1, mode: "Walk", travelTime: "13 min", x: "50%", y: "44%" },
      { time: "13:00", title: "Lunch · Bo de B", cat: "Restaurant", kid: true, age: "All ages", hours: "12:00–22:00", duration: "1 hr", blurb: "Famous overstuffed sandwiches — quick, cheap and kid-approved. Grab-and-go.", dist: 1.4, mode: "Walk", travelTime: "16 min", x: "56%", y: "46%" },
      { time: "14:30", title: "Picasso Museum", cat: "Museum", kid: false, age: "8+", hours: "10:00–19:00", duration: "1.5 hr", blurb: "Compact and manageable. Ages 8+ get the most from it; under-18s enter free.", dist: 4.5, mode: "Taxi", travelTime: "15 min", x: "52%", y: "40%" },
      { time: "16:30", title: "CosmoCaixa Science Museum", cat: "Museum", kid: true, age: "0–12 ★", hours: "10:00–20:00", duration: "2 hr", blurb: "A rainforest you walk through and tons of hands-on exhibits. Save the best for last.", dist: 0, mode: "", travelTime: "", x: "34%", y: "24%" },
    ],
  },
];

// Canned assistant replies (in production these stream from OpenRouter).
export const CHAT_REPLIES: { k: string[]; t: string }[] = [
  { k: ["rain", "rainy", "wet", "indoor"], t: "Good call to have a backup. Here's a rainy-day swap for each day:\n\n• Day 1 → trade Bunkers del Carmel for the CaixaForum art center (indoor, café on site).\n• Day 2 is already weatherproof — Aquàrium + the zoo's indoor houses.\n• Day 3 → CosmoCaixa is fully indoor, so you're covered.\n\nWant me to bake these in as the default plan?" },
  { k: ["busy", "less", "slower", "tired", "relax", "pace"], t: "Let's lighten Day 2. I'd drop Parc de la Ciutadella and give you a longer, unhurried beach evening instead:\n\n09:30 Zoo (2.5h) → 13:00 Lunch → 15:30 Aquàrium → 17:30 Barceloneta Beach (2h)\n\nThat removes one transfer and ~40 min of walking. Shall I apply it?" },
  { k: ["veg", "vegetarian", "vegan", "dinner", "eat", "food", "restaurant"], t: "For a veg-friendly dinner near your Day 1 route, I'd book Teresa Carles (Gothic, big veggie menu, kid options) or Flax & Kale. Both take a stroller and are a 10–12 min walk from Park Güell's exit. Want me to add one as the Day 1 dinner stop?" },
  { k: ["stroller", "pram", "buggy", "accessible", "wheelchair"], t: "Mostly yes. Park Güell's main terraces are stroller-friendly, though a couple of upper paths have steps — the side gate route avoids them. Sagrada Família and the Aquàrium are fully accessible. The Gothic Quarter is flat but cobbled. Want me to flag the step-free routes on the map?" },
  { k: ["add", "more", "another", "extra"], t: "Sure — what kind of stop? I can slot in a playground, a gelato break, a market (La Boqueria fits neatly before your Day 3 lunch), or a viewpoint. Tell me the day and I'll fit it without breaking your travel times." },
];

export const SUGGESTED_PROMPTS = [
  "Add a rainy-day backup",
  "Make day 2 less busy",
  "Find a vegetarian dinner",
  "Is Park Güell stroller-friendly?",
];

export const PACES = [
  { id: "relaxed", name: "Relaxed", icon: "sun", desc: "2–3 stops a day" },
  { id: "balanced", name: "Balanced", icon: "walk", desc: "4–5 stops a day" },
  { id: "packed", name: "Packed", icon: "zap", desc: "See it all" },
];

export const INITIAL_CHAT = [
  {
    role: "assistant" as const,
    text: "Hi Maya! I put together a 3-day Barcelona plan built around your two kids (6 & 9). Ask me to tweak anything — pace, food, rainy-day swaps — and I'll rework the schedule.",
  },
];

// ===== Pure helpers (date math + formatting) =====

export function nightsBetween(a?: string, b?: string): number | null {
  if (!a || !b) return null;
  const ms = new Date(b + "T00:00").getTime() - new Date(a + "T00:00").getTime();
  if (isNaN(ms)) return null;
  const d = Math.round(ms / 86400000);
  return d >= 0 ? d : null;
}

export function fmtMonthDay(s?: string): string | null {
  if (!s) return null;
  const d = new Date(s + "T00:00");
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function replyFor(text: string): string {
  const low = text.toLowerCase();
  for (const r of CHAT_REPLIES) {
    if (r.k.some((k) => low.includes(k))) return r.t;
  }
  return "On it. I'll factor that into the plan — anything else you'd like me to balance (timing, walking distance, kid age fit, or budget)? I can re-export the PDF once you're happy.";
}

export function recommend(a: Destination, b: Destination) {
  const key = (a.name || "").trim().toLowerCase() + "|" + (b.name || "").trim().toLowerCase();
  const ov = TRANSPORT_PAIRS[key];
  return { key: a.id + "-" + b.id, override: ov, recMode: (ov ? ov.mode : "Train") as TransportMode };
}
