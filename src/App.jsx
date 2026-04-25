import { useState, useCallback, useRef, useEffect } from "react";
import Step0Guided from './Step0Guided';
import Step0Advanced from './Step0Advanced';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const sbFetch = (path, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1${path}`, {
  ...opts,
  headers: {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": opts.prefer || "",
    ...(opts.headers || {})
  }
});


// Compress a string using gzip via CompressionStream, returns base64
async function compressString(str) {
  const stream = new CompressionStream("gzip");
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  writer.write(encoder.encode(str));
  writer.close();
  const chunks = [];
  const reader = stream.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { merged.set(c, offset); offset += c.length; }
  // Convert to base64
  let binary = "";
  for (let i = 0; i < merged.length; i++) binary += String.fromCharCode(merged[i]);
  return btoa(binary);
}

// Decompress base64 gzip back to string
async function decompressString(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const stream = new DecompressionStream("gzip");
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const chunks = [];
  const reader = stream.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { merged.set(c, offset); offset += c.length; }
  return new TextDecoder().decode(merged);
}

// WO type metadata — structure only, no hardcoded values
const WO_TYPES = {
  LVL:  { label: "LVL — Low Voltage Lead",          siteIdSuffix: "LVL(1)", numTechs: 1, numDays: 3, useBundle: true  },
  LVT:  { label: "LVT — Low Voltage Tech",           siteIdSuffix: "LVT",    numTechs: 3, numDays: 3, useBundle: true  },
  DEL:  { label: "DEL — Delivery/Install",           siteIdSuffix: "DEL",    numTechs: 1, numDays: 1, useBundle: false },
  BRK:  { label: "BRK — Backerboard Creation",          siteIdSuffix: "BRK",    numTechs: 1, numDays: 1, useBundle: false },
  INT:  { label: "INT — Installation Technician",        siteIdSuffix: "INT",    numTechs: 1, numDays: 1, useBundle: true  },
  INL:  { label: "INL — Installation Lead",              siteIdSuffix: "INL",    numTechs: 1, numDays: 1, useBundle: true  },
  WRK:  { label: "WRK — Walk In Ready Kit",            siteIdSuffix: "WRK",    numTechs: 1, numDays: 1, useBundle: false },
};

// Default configs per type — blank, user fills in each run
const BLANK_CFG = { templateId: "", startTime: "", defaultDate: "", techType: "Tech", numTechs: "1", numDays: "1", budgetTech: "", payRate: "", approxHours: "", country: "US", payType: "Fixed" };
const WO_DEFAULTS = {
  LVL:  { ...BLANK_CFG, templateId: "103095" },
  LVT:  { ...BLANK_CFG, templateId: "103094" },
  DEL:  { ...BLANK_CFG, templateId: "102221" },
  BRK:  { ...BLANK_CFG, templateId: "102222" },
  INT:  { ...BLANK_CFG, templateId: "103096" },
  INL:  { ...BLANK_CFG, templateId: "103097" },
  WRK:  { ...BLANK_CFG, templateId: "" },
};

// Build rows using live woConfig values
function buildRows(site, projectId, displayName, woType, cfg, allTypes) {
  const locPrefix = displayName.trim() || projectId;
  const meta = (allTypes || {})[woType] || WO_TYPES[woType] || { siteIdSuffix: woType, numTechs: 1, numDays: 1, useBundle: false };
  const rows = [];
  const tId = Number(cfg.templateId);
  const cfgBudget = Number(cfg.budgetTech);
  const cfgPay = Number(cfg.payRate);
  const hours = Number(cfg.approxHours);

  const numTechs = Number(site.numTechs || cfg.numTechs) || 1;
  const numDays = Number(site.numDays || cfg.numDays) || 1;
  const budget = site.budgetTech ? Number(site.budgetTech) : cfgBudget;
  const pay = site.payRate ? Number(site.payRate) : cfgPay;
  if (numTechs > 1) {
    for (let t = 1; t <= numTechs; t++) {
      for (let d = 0; d < numDays; d++) {
        const date = addDays(site.date, d);
        const siteId = `${site.code}-${meta.siteIdSuffix}(${t})`;
        const locName = `${locPrefix}-${siteId}-${site.city}, ${site.state}`;
        rows.push(makeRow({ templateId: tId, projectId, siteId, bundle: meta?.useBundle ? siteId : "", site, date, startTime: normalizeTime(cfg.startTime), techType: cfg.techType, budgetTech: budget, maxBudget: budget, payRate: pay, approxHours: hours, estDuration: hours, country: cfg.country, locName, payType: cfg.payType || "Fixed", routeTo: (site.routeToTechs || [])[t - 1] || "" }));
      }
    }
  } else {
    for (let d = 0; d < numDays; d++) {
      const date = addDays(site.date, d);
      const siteId = `${site.code}-${meta.siteIdSuffix}`;
      const locName = `${locPrefix}-${siteId}-${site.city}, ${site.state}`;
      rows.push(makeRow({ templateId: tId, projectId, siteId, bundle: meta?.useBundle ? siteId : "", site, date, startTime: normalizeTime(cfg.startTime), techType: cfg.techType, budgetTech: budget, maxBudget: budget, payRate: pay, approxHours: hours, estDuration: hours, country: cfg.country, locName, payType: cfg.payType || "Fixed", routeTo: (site.routeToTechs || [])[0] || "" }));
    }
    if (numDays > 1) rows.push([]);
  }
  return rows;
}

const WO_HEADERS = [
  "Template Id","Project ID","Site ID","Bundle (by Number)","Address #1","Address #2",
  "City","State","ZIP / Postal Code","Country","Type","Scheduled Start Date","Scheduled End Date",
  "Scheduled Start Time","Scheduled End Time","Tech \nType","Tech Name","Route To Provider (ID)",
  "Budget (Tech)","Budget (Travel)","Max Budget","Pay Rate","Additional Charges","Devices",
  "EST Hours","Size","Approximate Hours to Complete","Estimated Duration","Pay Type",
  "Location Display Name","Location Name","Work Order Manager"
];

function makeRow({ templateId, projectId, siteId, bundle, site, date, startTime, techType, budgetTech, maxBudget, payRate, approxHours, estDuration, country, locName, payType, routeTo }) {
  const womId = site.womId || "";
  return [
    templateId, projectId, siteId, bundle,
    site.address, site.address2 || "", site.city, site.state, site.zip,
    country, "", date, "", startTime, "",
    techType, "", routeTo || "",
    budgetTech, "", maxBudget, payRate,
    "", "", "", "", approxHours, estDuration, payType || "Fixed",
    locName, locName, womId
  ];
}



const FN_TEMPLATE_BANK = [
  { id: "103095", name: "LVL — Low Voltage Lead" },
  { id: "103094", name: "LVT — Low Voltage Tech" },
  { id: "102221", name: "DEL — Delivery/Install" },
  { id: "102222", name: "BRK — Backerboard Creation" },
  { id: "103096", name: "INT — Installation Technician" },
  { id: "103097", name: "INL — Installation Lead" },
];

function normalizeTime(raw) {
  // Converts any time format to "H:MMam/pm" as expected by FieldNation
  // e.g. "4:30pm", "4:30 PM", "16:30", "16:30:00" all → "4:30pm"
  if (!raw || !raw.trim()) return "";
  const s = raw.trim();

  // Already in "H:MMam/pm" or "H:MMam" format — normalize spacing/case
  const already = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (already) return `${parseInt(already[1])}:${already[2]}${already[3].toLowerCase()}`;

  // Plain "4pm" / "4 pm"
  const hourOnly = s.match(/^(\d{1,2})\s*(am|pm)$/i);
  if (hourOnly) return `${parseInt(hourOnly[1])}:00${hourOnly[2].toLowerCase()}`;

  // Military HH:MM or HH:MM:SS → convert to 12-hour am/pm
  const mil = s.match(/^(\d{1,2}):(\d{2})(:\d{2})?$/);
  if (mil) {
    let h = parseInt(mil[1]);
    const m = mil[2];
    const suffix = h >= 12 ? "pm" : "am";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${m}${suffix}`;
  }

  return s; // return as-is if unrecognized
}

function addDays(dateStr, n) {
  if (!dateStr || !dateStr.trim()) return "";
  const d = new Date(dateStr + "T12:00:00");
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function toCSV(headers, rows) {
  const escape = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    if (row.length === 0) { lines.push(""); continue; }
    lines.push(row.map(escape).join(","));
  }
  return lines.join("\r\n");
}

const EMPTY_SITE = () => ({
  code: "", branchName: "", address: "", address2: "",
  city: "", state: "", zip: "", date: "",
  numTechs: "", numDays: "", budgetTech: "", payRate: "", womId: "", routeToTechs: [],
  verified: null, verifying: false, verifyError: ""
});

const COLS = [
  { key: "code",       label: "Bldg Code",   width: 88,  ph: "FB1A" },
  { key: "branchName", label: "Branch Name", width: 170, ph: "Cascade Branch" },
  { key: "address",    label: "Address *",   width: 185, ph: "2 N Cascade Ave" },
  { key: "address2",   label: "Suite/Floor", width: 100, ph: "Ste 100" },
  { key: "city",       label: "City *",      width: 130, ph: "Colorado Springs" },
  { key: "state",      label: "ST *",        width: 50,  ph: "CO" },
  { key: "zip",        label: "ZIP *",       width: 72,  ph: "80903" },
  { key: "date",       label: "Start Date *",width: 128, ph: "", type: "date" },
  { key: "numTechs",   label: "Techs",       width: 54,  ph: "↓" },
  { key: "numDays",    label: "Days",        width: 54,  ph: "↓" },
  { key: "budgetTech", label: "Budget $",    width: 80,  ph: "↓" },
  { key: "payRate",    label: "Pay $",       width: 80,  ph: "↓" },
  { key: "womId",     label: "WOM ID",      width: 100, ph: "WO-12345" },
];


const BUILTIN_PARSERS = [
  { id: "fmt1",  name: "SiteList (Original)",         delim: "tab",   cols: "12+", signal: "12+ tab cols, address at col 4",                  map: { code:0, branchName:1, address:4, city:5, state:6, zip:7, date:11 } },
  { id: "fmt2",  name: "Building Headers",             delim: "tab",   cols: "any", signal: "Header row with buildingcode/buildingname",         map: { code:"buildingcode", branchName:"buildingname", address:"address", city:"city", state:"state", zip:"zip", date:"date" } },
  { id: "fmt3a", name: "Comma Compact (state+zip)",    delim: "comma", cols: "5",   signal: "Comma-delimited, last field is 'ST 12345'",         map: { code:0, branchName:1, address:2, city:3, stateZipCombined:4 } },
  { id: "fmt3b", name: "Comma Compact (separate)",     delim: "comma", cols: "6",   signal: "Comma-delimited, separate state and zip fields",    map: { code:0, branchName:1, address:2, city:3, state:4, zip:5 } },
  { id: "fmt4",  name: "Services Sheet (with services)",delim: "tab",  cols: "11+", signal: "Tab, 8+ cols, has 'Scheduled' + quarter, quoted services col", map: { code:0, branchName:1, address:5, city:6, state:7, zip:8, date:11 } },
  { id: "fmt5",  name: "Services Sheet (no services)", delim: "tab",   cols: "11+", signal: "Tab, 8+ cols, quarter at col 2",                   map: { code:0, branchName:1, address:4, city:5, state:6, zip:7, date:11 } },
  { id: "fmt6",  name: "Bool+Region Sheet",            delim: "tab",   cols: "7-11",signal: "Tab, col 2 is true/false",                         map: { code:0, branchName:1, address:4, city:5, state:6, zip:7, date:9 } },
  { id: "fmt7",  name: "Code + Full Address",          delim: "tab",   cols: "2-3", signal: "Tab, 2-3 cols, last col contains commas",           map: { code:0, branchName:"col1_if_not_date", address:"from_last_col_csv", city:"from_last_col_csv", state:"from_last_col_csv", zip:"from_last_col_csv", date:"col1_if_date" } },
  { id: "fmt8",  name: "Space-Code + Comma Address",   delim: "comma", cols: "3+",  signal: "Comma-delimited, first field starts with CODE+spaces", map: { code:"first_token", branchName:"text_before_street_num", address:"text_from_street_num", city:"penultimate_comma_part", state:"last_part_ST", zip:"last_part_zip" } },
  { id: "fmt9",  name: "3-Line Block",                 delim: "none",  cols: "n/a", signal: "Line 1 = bare code, line 2 = date, line 3 = address,city,ST,zip", map: { code:"line0", date:"line1", address:"line2_csv0", city:"line2_csv1", state:"line2_csv2", zip:"line2_csv3" } },
];

const STEP_LABELS = ["Project Info", "Add Sites", "Review & Export"];

const JOKES = [
  "Why did the field technician bring a ladder? Because the job was on another level.",
  "Why don't work orders ever get lonely? Because they always come in bundles.",
  "I told my boss I needed more tech support. He sent me three techs and a lead. Close enough.",
  "Why did the LVL tech get promoted? He always rose to the occasion.",
  "A DEL tech walks into a bar. Bartender says 'we don't serve your type here.' Tech says 'that's fine, I'm just here to deliver.'",
  "How many FieldNation techs does it take to change a lightbulb? One, but you have to submit a work order first.",
  "Why did the CSV file go to therapy? It had too many unresolved columns.",
  "I asked the installation tech if the job was hard. He said 'nah, it's just a lot of screws.' Story of my life.",
  "Why did the backerboard tech stay calm under pressure? He was used to being mounted against a wall.",
  "What did the project manager say to the confused technician? 'It's all in the WO, man.'",
  "Why did the tech refuse to work weekends? His contract said 1 tech × 1 day.",
  "The FieldNation upload failed. Turns out it was a CSV trauma response.",
  "Why do installation leads always look confident? Because they've been there, done that, and have the T-shirt template ID to prove it.",
  "What's a tech's favorite music? Heavy metal — specifically the kind you bolt to walls.",
  "I tried to explain FieldNation to my grandma. She said 'sounds like a fancy to-do list.' She's not wrong.",
  "Why was the work order so emotional? It had too many unresolved dependencies.",
  "The tech showed up 3 days in a row. On day 3 he said 'I think I live here now.'",
  "Why don't IT guys go outside? Because there are no tech trees.",
  "Jordan told the tech to 'just follow the WO'. The tech followed it to a Starbucks. No regrets.",
  "A BRK tech, a DEL tech, and an INT tech walk into a bank. The manager says 'which one of you is the lead?' They all point at each other.",
  "The work order said 'arrive between 8am and 5pm.' The tech showed up at 4:59. Technically.",
  "Site survey complete. Address verified. Tech routed. CSV downloaded. Jordan: 'wait can we add one more site.'",
  "Why did Chris Pratt name the tool after himself? He didn't. We just needed someone to blame.",
  "The DEL tech delivered the equipment. The INT tech installed it. The LVL tech took the credit.",
  "FieldNation: where 'scheduled start time' is more of a suggestion.",
  "Error 404: Tech motivation not found. Have you tried turning the pay rate off and on again?",
];

const EASTER_EGGS = [
  "🎉 KONAMI CODE ACTIVATED — You found it. Unfortunately this unlocks nothing. Good hustle though.",
  "☕ COFFEE BREAK MODE — Productivity temporarily suspended. Please hydrate.",
  "🏆 100 SITES PARSED — That's a lot of branches. Your wrists deserve a raise.",
  "🎸 IT'S FRIDAY — Deploy on Fridays. Live dangerously. Jordan said it's fine.",
  "🤙 CHRIS PRATT APPROVES — Star-Lord has reviewed your work order and finds it acceptable.",
  "🔥 ON A ROLL — 5 jobs generated today. The FieldNation servers felt that.",
];

const AFFIRMATIONS = [
  "Work order game strong 💪",
  "Deploying like a pro 🚀",
  "CSV go brrr 📊",
  "Bundle life 🔗",
  "Template ID secured ✅",
  "Sites verified. Let's get it 🏙️",
];

const LOGO_IMG = "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAKKADAAQAAAABAAAALQAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgALQAoAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAQEBAQEBAgEBAgMCAgIDBAMDAwMEBgQEBAQEBgcGBgYGBgYHBwcHBwcHBwgICAgICAkJCQkJCwsLCwsLCwsLC//bAEMBAgICAwMDBQMDBQsIBggLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLC//dAAQAA//aAAwDAQACEQMRAD8A/p0/aW/bN8DfAEHQLRP7W8QypuSzifCxg9GlbnaD2GCx9Mc1+SPjj9tf9pHx/dvKNcbSLZiSsGnL5IXP+3zIf++/yr4+vfEWr+JdauNe124e7vLyRpZppTud3Y5JJr5+/ab+MPiL4Z+DINO8CxK+uawXitnbG2EIMtIQeuMjHvUVMR9q+h1U6dSrNQgtWfeUf7R3xp0C7S4m8d6rFKzAKJ7+R1JPQbZGI59MV9hfCD/gop8VPC9zFZ/EtE8Q6ccbp41WK5Ueo24R/oQCf71fxweH/gX8Tfir4xXXPFeuXF/qE8pMs0rluvG1R/CvsuBX64/ATTPih8Kruy+FnxBH2vT7iInTrvpgIMmM8flmueljqU58sZ6nq4nIsfhqXtpwdkf2f/Db4oeDvix4Yg8WeC7xbq0nHY4ZGHVXUnKsO4Nd/ke3+fxr+dD9mL43ar8C/iJDdPO39i6g6xahD1XaeBIBnhkznPdciv1T/wCG4fgn/wBBMf8AfJ/xr0FPucMK8WtdGf/Q6Gy3K3zda+N/2v8AxBYaZe6S94cC2gmlbHJAcgDA99p/KvpvTPFNpNJhmHNfHH7ZmoWFgtvr15GJ4Xtmix7qxP8AWvKxMv3TsfT8O04SxsOZ23f4E/7KHiDQfHGqXeqaFfKtvpObm9Lr80UMYyzH6f1r9n3fwJ49+Eth4z8NzC+FvOvlS7cHpjIHp71+K/8AwTdtfDWr+MdQt72OGKK706eHyGXIuWm28DscDk544r9h/hFpGl+GP2f9ZjuLgi+ivPsbQKFCQhW+UDbxgjn1ryaMHGtFqPVH6NmtqmBqc9RfC72MDiQZNJ5a/wCRVezm3qTnirm9a+sPxJn/0fzL8c/tZfDHwZqD2s2vWoMRO7ZIJDkdsLk18p/F/wDbl+HfxNtLPwPpST3txLcBROV2RopBz15OeOMV82/8FKP2f/Dnw116H4t+FbqaF/EN5It3aEkp57Au0qsTkbjncuCMnII6V+Z3hi5vZdYtFWeRDJKFyGORnv17Vyyw+jR6WFxXsqkZrdM/qe/YM8ZaroWo+a8m3RpvMRnMvlRxAY3FiOVHTjPNejeMf+ClPwX8BfGNvgfoM8MHhCAPcXmqLufzdQcgcBcnYAMZwa/mO1z4p/ELRdOktbbWb3aSUwLh1Hp0zXgM+s6vdTGWe5kZnPJLE9fxrlwuH97nex9HnOcutSVCKtfc/wBAL9mDxT4Z/aX8Xaf4a+F+r2urC7YGV7aQOYYRy7uvVcDpuA5wO9fqR/wwrqH/AEFj/wB8r/jX8q37Bvw01H9lXwcms/DPxFqdprWtwRvfahbXElrLKpG5Yx5bjbGpPC5OTySeMfoX/wANI/tHf9FB8S/+Da6/+O16TkfJqnH7R//Z";


const SESSION_MS = 8 * 60 * 60 * 1000; // 8 hours

function loadSession() {
  try {
    const raw = sessionStorage.getItem("cpwog_session");
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (Date.now() - s.loginTime > SESSION_MS) {
      sessionStorage.removeItem("cpwog_session");
      return null;
    }
    return s;
  } catch { return null; }
}

function saveSession(patch) {
  try {
    const existing = loadSession() || { loginTime: Date.now() };
    sessionStorage.setItem("cpwog_session", JSON.stringify({ ...existing, ...patch }));
  } catch {}
}

export default function App() {
  const _s = loadSession();
  const [authed, setAuthed] = useState(() => !!_s);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [step, setStep] = useState(() => _s?.step ?? 0);
  const [joke, setJoke] = useState(() => JOKES[Math.floor(Math.random() * JOKES.length)]);
  const [projectId, setProjectId] = useState(() => _s?.projectId ?? "");
  const [displayName, setDisplayName] = useState(() => _s?.displayName ?? "");
  const [woType, setWoType] = useState(() => _s?.woType ?? "LVL");
  const [woConfig, setWoConfig] = useState(() => _s?.woConfig ?? { ...WO_DEFAULTS["LVL"] });
  const [sites, setSites] = useState(() => _s?.sites ?? [EMPTY_SITE()]);
  const [generating, setGenerating] = useState(false);
  const [activeCell, setActiveCell] = useState({ row: 0, col: 0 });
  const [pasteText, setPasteText] = useState("");
  const [pasteMode, setPasteMode] = useState(true);
  const [pasteError, setPasteError] = useState("");
  const [clearConfirm, setClearConfirm] = useState(false);
  const [startOverConfirm, setStartOverConfirm] = useState(false);
  const [delConfig, setDelConfig] = useState(() => _s?.delConfig ?? { ...WO_DEFAULTS["DEL"] });
  const [includeDEL, setIncludeDEL] = useState(() => _s?.includeDEL ?? false);
  const [brkConfig, setBrkConfig] = useState(() => _s?.brkConfig ?? { ...WO_DEFAULTS["BRK"] });
  const [includeBRK, setIncludeBRK] = useState(() => _s?.includeBRK ?? false);
  const [wrkConfig, setWrkConfig] = useState(() => _s?.wrkConfig ?? { ...WO_DEFAULTS["WRK"] });
  const [includeWRK, setIncludeWRK] = useState(() => _s?.includeWRK ?? false);
  const [importMode, setImportMode] = useState(false);
  const fileInputRef = useRef(null);
  const inputRefs = useRef({});
  const [dark, setDark] = useState(() => { try { return sessionStorage.getItem("cpwog_dark") === "1"; } catch { return false; } });

  // Easter egg: konami code listener
  useEffect(() => {
    const handler = (e) => {
      konamiRef.current = [...konamiRef.current, e.key].slice(-10);
      if (konamiRef.current.join(",") === konamiCode.join(",")) {
        setEasterEgg(EASTER_EGGS[0]);
        setTimeout(() => setEasterEgg(null), 10000);
        konamiRef.current = [];
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Friday mode
  useEffect(() => {
    const day = new Date().getDay();
    if (day === 5 && authed) {
      setTimeout(() => {
        setEasterEgg(EASTER_EGGS[3]);
        setTimeout(() => setEasterEgg(null), 10000);
      }, 3000);
    }
  }, [authed]);

  // Track previous woConfig to detect which fields changed
  const prevConfigRef = useRef(woConfig);
  useEffect(() => {
    const prev = prevConfigRef.current;
    setSites(s => s.map(site => {
      const updates = {};
      // Sync numTechs if site still matches old default (not manually overridden to something different)
      if (prev.numTechs !== woConfig.numTechs && site.numTechs === prev.numTechs) {
        updates.numTechs = woConfig.numTechs;
      }
      // Sync numDays if site still matches old default
      if (prev.numDays !== woConfig.numDays && site.numDays === prev.numDays) {
        updates.numDays = woConfig.numDays;
      }
      // Sync date unless user manually overrode it for this site
      if (prev.defaultDate !== woConfig.defaultDate && !site.dateOverridden) {
        updates.date = woConfig.defaultDate || "";
      }
      return Object.keys(updates).length ? { ...site, ...updates } : site;
    }));
    prevConfigRef.current = woConfig;
  }, [woConfig.numTechs, woConfig.numDays, woConfig.defaultDate]);

  // Persist work state to session on every relevant change
  useEffect(() => {
    if (authed) saveSession({ step, projectId, displayName, woType, woConfig, sites, delConfig, includeDEL, brkConfig, includeBRK, wrkConfig, includeWRK });
  }, [step, projectId, displayName, woType, woConfig, sites, authed]);

  // Persist dark mode preference
  useEffect(() => {
    try { sessionStorage.setItem("cpwog_dark", dark ? "1" : "0"); } catch {}
  }, [dark]);

  // Auto-logout: check every minute if session has expired
  useEffect(() => {
    const interval = setInterval(() => {
      if (authed && !loadSession()) {
        setAuthed(false);
        setStep(0);
        setProjectId("");
        setDisplayName("");
        setWoType("LVL");
        setWoConfig({ ...WO_DEFAULTS["LVL"] });
        setSites([EMPTY_SITE()]);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [authed]);
  const [templateIdHistory, setTemplateIdHistory] = useState({});   // { LVL: [{id, label}, ...], ... }
  const [showTidDropdown, setShowTidDropdown] = useState(false);
  const [showDelTidDropdown, setShowDelTidDropdown] = useState(false);
  const [showBrkTidDropdown, setShowBrkTidDropdown] = useState(false);
  const [showWrkTidDropdown, setShowWrkTidDropdown] = useState(false);
  const [delTidLabelInput, setDelTidLabelInput] = useState("");
  const [brkTidLabelInput, setBrkTidLabelInput] = useState("");
  const [wrkTidLabelInput, setWrkTidLabelInput] = useState("");
  const [customWoTypes, setCustomWoTypes] = useState({});
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [editingCustomKey, setEditingCustomKey] = useState(null);
  const [customForm, setCustomForm] = useState({ key: "", label: "", siteIdSuffix: "", numTechs: "1", numDays: "1", useBundle: false });
  const [deletedBuiltins, setDeletedBuiltins] = useState({});
  const [overriddenBuiltins, setOverriddenBuiltins] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { key, isBuiltin }
  const [deletePw, setDeletePw] = useState("");
  const [deletePwError, setDeletePwError] = useState(false);
  const [showRecoverModal, setShowRecoverModal] = useState(false);
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [guidedMode, setGuidedMode] = useState(() => { try { return localStorage.getItem("cpwog_guided") !== "0"; } catch { return true; } });
  const [woTemplates, setWoTemplates] = useState([]);
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [templateSaveName, setTemplateSaveName] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [bulkDateInput, setBulkDateInput] = useState("");
  const [showBulkDate, setShowBulkDate] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [jobHistory, setJobHistory] = useState([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showParserPanel, setShowParserPanel] = useState(false);
  const [siteLibrary, setSiteLibrary] = useState([]);
  const [showLibraryPanel, setShowLibraryPanel] = useState(false);
  const [librarySaveName, setLibrarySaveName] = useState("");
  const [showSaveLibrary, setShowSaveLibrary] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libSelected, setLibSelected] = useState(new Set()); // Set of "entryId:siteIdx"
  const [libExpanded, setLibExpanded] = useState(new Set()); // Set of entry IDs
  const [libLastClick, setLibLastClick] = useState(null); // {entryId, idx} for shift-select
  const [easterEgg, setEasterEgg] = useState(null);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [aiParserLoading, setAiParserLoading] = useState(false);
  const [aiParserError, setAiParserError] = useState("");
  const [aiPasteLoading, setAiPasteLoading] = useState(false);
  const konamiRef = useRef([]);
  const konamiCode = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
  const [customParsers, setCustomParsers] = useState([]);
  const [editingParser, setEditingParser] = useState(null);
  const [parserForm, setParserForm] = useState({ name: "", delim: "tab", signal: "", sampleData: "", colCode: "0", colBranch: "1", colAddr: "2", colCity: "3", colState: "4", colZip: "5", colDate: "", colFullAddr: "" });
  const [parserPreview, setParserPreview] = useState([]);
  const [parserPreviewError, setParserPreviewError] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockPwInput, setLockPwInput] = useState("");
  const [lockPwError, setLockPwError] = useState(false);
  const [projectIdHistory, setProjectIdHistory] = useState([]);
  const [displayNameHistory, setDisplayNameHistory] = useState([]);
  const [showPidDropdown, setShowPidDropdown] = useState(false);
  const [showDnDropdown, setShowDnDropdown] = useState(false);
  const [pendingTidLabel, setPendingTidLabel] = useState(null); // {type, id} waiting for label
  const [tidLabelInput, setTidLabelInput] = useState("");

  const ALL_WO_TYPES = Object.fromEntries(
    Object.entries({ ...WO_TYPES, ...customWoTypes })
      .filter(([k]) => !deletedBuiltins[k])
      .map(([k, v]) => [k, overriddenBuiltins[k] ? { ...v, ...overriddenBuiltins[k] } : v])
  );

  // Load saved template ID history from Supabase on mount
  useEffect(() => {
    sbFetch("/template_id_history?id=eq.1&select=data")
      .then(r => r.ok ? r.json() : null)
      .then(rows => { if (rows?.[0]?.data) setTemplateIdHistory(rows[0].data); })
      .catch(() => {});
    sbFetch("/job_history?select=*&order=created_at.desc&limit=100")
      .then(r => r.ok ? r.json() : null)
      .then(rows => { if (Array.isArray(rows)) setJobHistory(rows); })
      .catch(() => {});
    sbFetch("/custom_wo_types?id=eq.1&select=data")
      .then(r => r.ok ? r.json() : null)
      .then(rows => {
        if (rows?.[0]?.data) {
          const d = rows[0].data;
          // Handle both nested shape { custom, deletedBuiltins, overriddenBuiltins }
          // and old flat shape where the whole object was custom types
          if (d.custom !== undefined) {
            setCustomWoTypes(d.custom || {});
          } else if (typeof d === "object" && !Array.isArray(d)) {
            // Old flat shape — treat whole object as custom types
            const isOldShape = Object.values(d).every(v => v && typeof v === "object" && "siteIdSuffix" in v);
            if (isOldShape && Object.keys(d).length > 0) setCustomWoTypes(d);
          }
          if (d.deletedBuiltins) setDeletedBuiltins(d.deletedBuiltins);
          if (d.overriddenBuiltins) setOverriddenBuiltins(d.overriddenBuiltins);
        }
      })
      .catch(() => {});
    sbFetch("/site_library?select=*&order=created_at.desc&limit=50")
      .then(r => r.ok ? r.json() : null)
      .then(rows => { if (Array.isArray(rows)) setSiteLibrary(rows); })
      .catch(() => {});
    sbFetch("/wo_templates?id=eq.1&select=data")
      .then(r => r.ok ? r.json() : null)
      .then(rows => { if (rows?.[0]?.data) setWoTemplates(rows[0].data || []); })
      .catch(() => {});
    sbFetch("/custom_parsers?id=eq.1&select=data")
      .then(r => r.ok ? r.json() : null)
      .then(rows => { if (rows?.[0]?.data) setCustomParsers(rows[0].data || []); })
      .catch(() => {});
    sbFetch("/project_history?id=eq.1&select=project_ids,display_names")
      .then(r => r.ok ? r.json() : null)
      .then(rows => {
        if (rows?.[0]) {
          if (rows[0].project_ids) setProjectIdHistory(rows[0].project_ids);
          if (rows[0].display_names) setDisplayNameHistory(rows[0].display_names);
        }
      })
      .catch(() => {});
  }, []);

  const saveTemplateId = (type, id, label = "") => {
    if (!id.trim()) return;
    setTemplateIdHistory(prev => {
      const existing = prev[type] || [];
      const entry = { id, label: label.trim() };
      const updated = [entry, ...existing.filter(x => x.id !== id)].slice(0, 10);
      const next = { ...prev, [type]: updated };
      sbFetch("/template_id_history?id=eq.1", {
        method: "PATCH",
        prefer: "return=minimal",
        body: JSON.stringify({ data: next, updated_at: new Date().toISOString() })
      }).catch(() => {});
      return next;
    });
  };

  const saveProjectId = (id) => {
    if (!id.trim()) return;
    setProjectIdHistory(prev => {
      const updated = [id, ...prev.filter(x => x !== id)].slice(0, 15);
      sbFetch("/project_history?id=eq.1", { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ project_ids: updated, updated_at: new Date().toISOString() }) }).catch(() => {});
      return updated;
    });
  };

  const saveDisplayName = (name) => {
    if (!name.trim()) return;
    setDisplayNameHistory(prev => {
      const updated = [name, ...prev.filter(x => x !== name)].slice(0, 15);
      sbFetch("/project_history?id=eq.1", { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ display_names: updated, updated_at: new Date().toISOString() }) }).catch(() => {});
      return updated;
    });
  };

  const persistWoTypeData = (custom, deleted, overridden) => {
    sbFetch("/custom_wo_types?id=eq.1", {
      method: "PATCH", prefer: "return=minimal",
      body: JSON.stringify({ data: { custom, deletedBuiltins: deleted, overriddenBuiltins: overridden }, updated_at: new Date().toISOString() })
    })
      .then(r => { if (!r.ok) r.text().then(t => console.error("custom_wo_types save failed:", t)); })
      .catch(e => console.error("custom_wo_types network error:", e));
  };
  const saveJob = (extraData = {}) => {
    const job = {
      project_id:   projectId,
      display_name: displayName,
      wo_type:      woType,
      wo_config:    woConfig,
      del_config:   includeDEL ? delConfig : null,
      include_del:  includeDEL,
      brk_config:   includeBRK ? brkConfig : null,
      include_brk:  includeBRK,
      wrk_config:   includeWRK ? wrkConfig : null,
      include_wrk:  includeWRK,
      sites:        sites.filter(s => s.code || s.address),
      site_count:   sites.filter(rowComplete).length,
      created_at:   new Date().toISOString(),
      ...extraData,
    };
    sbFetch("/job_history", {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify(job)
    })
      .then(r => {
        console.log("job_history POST status:", r.status);
        if (!r.ok) { r.text().then(t => console.error("saveJob failed:", r.status, t)); return null; }
        return r.json();
      })
      .then(rows => { if (rows?.[0]) setJobHistory(prev => [rows[0], ...prev].slice(0, 100)); })
      .catch(e => console.error("saveJob network error:", e));
  };

  const generateParserWithAI = async () => {
    if (!parserForm.sampleData?.trim()) {
      setAiParserError("Paste some sample data first so the AI can analyze it.");
      return;
    }
    setAiParserLoading(true);
    setAiParserError("");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cpwog-secret": import.meta.env.VITE_AI_SECRET || "" },
        body: JSON.stringify({ sampleData: parserForm.sampleData.trim().slice(0, 800) })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || err.error || `Server error ${response.status}`);
      }
      const parsed = await response.json();
      setParserForm(prev => ({ ...prev, ...parsed, sampleData: prev.sampleData }));
      runParserPreview({ ...parserForm, ...parsed });
    } catch (e) {
      setAiParserError("AI parse failed: " + e.message + " — fill in columns manually.");
    }
    setAiParserLoading(false);
  };

  const saveToLibrary = async (name) => {
    if (!name.trim()) return;
    const completeSites = sites.filter(s => s.code || s.address);
    if (completeSites.length === 0) return;
    const entry = {
      project_name: name.trim(),
      project_id: projectId,
      sites: completeSites,
      site_count: completeSites.length,
      source_format: "manual",
      created_at: new Date().toISOString()
    };
    sbFetch("/site_library", {
      method: "POST", prefer: "return=representation",
      body: JSON.stringify(entry)
    })
      .then(r => r.ok ? r.json() : null)
      .then(rows => { if (rows?.[0]) setSiteLibrary(prev => [rows[0], ...prev].slice(0, 50)); })
      .catch(e => console.error("saveToLibrary failed:", e));
  };

  const loadFromLibrary = (entry) => {
    const loaded = (entry.sites || []).map(s => ({
      ...EMPTY_SITE(), ...s,
      numTechs: s.numTechs || woConfig.numTechs || "1",
      numDays: s.numDays || woConfig.numDays || "1",
      date: s.date || woConfig.defaultDate || "",
      verified: null, verifying: false, verifyError: ""
    }));
    setSites(prev => {
      const ex = prev.filter(s => s.code || s.address || s.branchName);
      return ex.length > 0 ? [...ex, ...loaded] : loaded;
    });
    setShowLibraryPanel(false);
  };

  const deleteFromLibrary = (id) => {
    sbFetch(`/site_library?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }).catch(() => {});
    setSiteLibrary(prev => prev.filter(l => l.id !== id));
  };

  const saveWoTemplates = (next) => {
    setWoTemplates(next);
    sbFetch("/wo_templates?id=eq.1", {
      method: "PATCH", prefer: "return=minimal",
      body: JSON.stringify({ data: next, updated_at: new Date().toISOString() })
    }).then(r => { if (!r.ok) r.text().then(t => console.error("saveWoTemplates failed:", t)); }).catch(() => {});
  };

  const saveCurrentAsTemplate = (name) => {
    if (!name.trim()) return;
    const entry = {
      id: `tpl_${Date.now()}`,
      name: name.trim(),
      woType, woConfig: { ...woConfig },
      includeDEL, delConfig: { ...delConfig },
      includeBRK, brkConfig: { ...brkConfig },
      includeWRK, wrkConfig: { ...wrkConfig },
      created_at: new Date().toISOString()
    };
    saveWoTemplates([entry, ...woTemplates]);
  };

  const applyTemplate = (tpl) => {
    setWoType(tpl.woType || woType);
    if (tpl.woConfig) setWoConfig({ ...tpl.woConfig });
    setIncludeDEL(!!tpl.includeDEL);
    if (tpl.delConfig) setDelConfig({ ...tpl.delConfig });
    setIncludeBRK(!!tpl.includeBRK);
    if (tpl.brkConfig) setBrkConfig({ ...tpl.brkConfig });
    setIncludeWRK(!!tpl.includeWRK);
    if (tpl.wrkConfig) setWrkConfig({ ...tpl.wrkConfig });
    setShowTemplatePanel(false);
  };

  const saveCustomParsers = (next) => {
    setCustomParsers(next);
    sbFetch("/custom_parsers?id=eq.1", {
      method: "PATCH", prefer: "return=minimal",
      body: JSON.stringify({ data: next, updated_at: new Date().toISOString() })
    }).then(r => { if (!r.ok) r.text().then(t => console.error("saveCustomParsers failed:", t)); }).catch(() => {});
  };


  // Split a combined address column into parts
  const splitFullAddr = (str) => {
    const parts = str.split(",").map(p => p.trim());
    // Last part could be "CO 80602" (state+zip) or separate
    const last = parts[parts.length - 1] || "";
    const stateZip = last.match(/^([A-Z]{2})\s+(\d{5}(-\d{4})?)$/);
    if (stateZip) {
      return { address: parts[0] || "", city: parts[1] || "", state: stateZip[1], zip: stateZip[2] };
    }
    return { address: parts[0] || "", city: parts[1] || "", state: parts[2] || "", zip: parts[3] || "" };
  };

  const runParserPreview = (form) => {
    setParserPreviewError("");
    setParserPreview([]);
    const raw = (form.sampleData || "").trim();
    if (!raw) return;
    try {
      const delim = form.delim === "tab" ? "\t" : ",";
      const lines = raw.split("\n").map(l => l.split(delim).map(c => c.trim()));
      const get = (cols, idx) => { const n = parseInt(idx); return isNaN(n) ? "" : (cols[n] || ""); };
      const rows = lines.filter(c => c.length > 1).map(cols => {
        const base = {
          code:       get(cols, form.colCode),
          branchName: get(cols, form.colBranch),
          date:       get(cols, form.colDate),
        };
        if (form.colFullAddr && !isNaN(parseInt(form.colFullAddr))) {
          const combined = get(cols, form.colFullAddr);
          const { address, city, state, zip } = splitFullAddr(combined);
          return { ...base, address, city, state, zip };
        }
        return { ...base,
          address: get(cols, form.colAddr),
          city:    get(cols, form.colCity),
          state:   get(cols, form.colState),
          zip:     get(cols, form.colZip),
        };
      }).filter(r => r.code || r.address);
      if (rows.length === 0) { setParserPreviewError("No rows matched — check your column indices"); return; }
      setParserPreview(rows);
    } catch (e) {
      setParserPreviewError(e.message);
    }
  };

  const applyCustomParser = (parser) => {
    const raw = (parser.sampleData || "").trim();
    if (!raw) return;
    runParserPreview(parser);
  };

  const saveCustomWoTypes = (next, deleted = deletedBuiltins, overridden = overriddenBuiltins) => {
    setCustomWoTypes(next);
    persistWoTypeData(next, deleted, overridden);
  };
  const saveDeletedBuiltins = (next) => {
    setDeletedBuiltins(next);
    persistWoTypeData(customWoTypes, next, overriddenBuiltins);
  };
  const saveOverriddenBuiltins = (next) => {
    setOverriddenBuiltins(next);
    persistWoTypeData(customWoTypes, deletedBuiltins, next);
  };

  const getEntryLabel = (type, id) => {
    const entries = templateIdHistory[type] || [];
    const entry = entries.find(e => (typeof e === "string" ? e : e.id) === id);
    if (!entry) return "";
    return typeof entry === "string" ? "" : entry.label || "";
  };

  const handleContinueStep0 = () => {
    saveProjectId(projectId);
    if (displayName.trim()) saveDisplayName(displayName);
    // Save DEL template ID to history if checkbox is on and ID is filled
    if (includeBRK && brkConfig.templateId?.trim()) {
      saveTemplateId("BRK", brkConfig.templateId.trim(), brkTidLabelInput || "");
    }
    if (includeWRK && wrkConfig.templateId?.trim()) {
      saveTemplateId("WRK", wrkConfig.templateId.trim(), wrkTidLabelInput || "");
    }
    if (includeDEL && delConfig.templateId?.trim()) {
      saveTemplateId("DEL", delConfig.templateId.trim(), delTidLabelInput || "");
    }
    const id = woConfig.templateId.trim();
    if (!id) { setStep(s => { setJoke(JOKES[Math.floor(Math.random() * JOKES.length)]); return s + 1; }); return; }
    const existing = (templateIdHistory[woType] || []).find(e => (typeof e === "string" ? e : e.id) === id);
    if (!existing) {
      // New template ID — prompt for label
      setPendingTidLabel({ type: woType, id });
      setTidLabelInput("");
    } else {
      saveTemplateId(woType, id, typeof existing === "string" ? "" : existing.label);
      setStep(s => { setJoke(JOKES[Math.floor(Math.random() * JOKES.length)]); return s + 1; });
    }
  };

  const confirmTidLabel = (skip = false) => {
    if (pendingTidLabel) {
      saveTemplateId(pendingTidLabel.type, pendingTidLabel.id, skip ? "" : tidLabelInput);
      setPendingTidLabel(null);
      setTidLabelInput("");
      setStep(s => { setJoke(JOKES[Math.floor(Math.random() * JOKES.length)]); return s + 1; });
    }
  };

  const T = dark ? {
    bg:       "#0f0f10", surface: "#18181b", surface2: "#111",
    border:   "#27272a", border2: "#3f3f46", borderRow: "#1f1f1f",
    rowAlt:   "#161618", rowHover: "#1c1c1e",
    text:     "#e4e4e7", textMid:  "#a1a1aa", textDim:  "#71717a", textFaint: "#52525b",
    accent:   "#e97316", accentHi: "#fb923c",
    header:   "#111",
    inp:      { width:"100%", background:"#111", border:"1px solid #3f3f46", borderRadius:7, padding:"9px 13px", color:"#e4e4e7", fontSize:13, fontFamily:"inherit", transition:"border-color .2s" },
    tabActive:"#e97316", tabInactive:"#52525b", tabHover:"#a1a1aa",
    cardSel:  "#1c1009",
    btnBack:  "#1c1c1e",
    disabledBg: "#27272a", disabledText: "#52525b",
  } : {
    bg:       "#f4f4f5", surface: "#ffffff", surface2: "#f9f9f9",
    border:   "#e4e4e7", border2: "#d4d4d8", borderRow: "#e4e4e7",
    rowAlt:   "#f9f9f9", rowHover: "#f0f0f0",
    text:     "#18181b", textMid:  "#3f3f46", textDim:  "#52525b", textFaint: "#71717a",
    accent:   "#ea6a00", accentHi: "#c2530a",
    header:   "#ffffff",
    inp:      { width:"100%", background:"#fff", border:"1px solid #d4d4d8", borderRadius:7, padding:"9px 13px", color:"#18181b", fontSize:13, fontFamily:"inherit", transition:"border-color .2s" },
    tabActive:"#ea6a00", tabInactive:"#71717a", tabHover:"#3f3f46",
    cardSel:  "#fff7ed",
    btnBack:  "#e4e4e7",
    disabledBg: "#e4e4e7", disabledText: "#71717a",
  };

  const isPastDate = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr + "T12:00:00");
    if (isNaN(d)) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    return d < today;
  };

  const updateSite = (i, field, val) =>
    setSites(prev => prev.map((s, idx) => {
      if (idx !== i) return s;
      const addrFields = ["address", "city", "state", "zip"];
      return { ...s, [field]: val, verified: addrFields.includes(field) ? null : s.verified, verifyError: "", ...(field === "date" ? { dateOverridden: true } : {}) };
    }));

  const addRows = (n) => setSites(prev => [...prev, ...Array(n).fill(null).map(() => ({ ...EMPTY_SITE(), date: woConfig.defaultDate || "", numTechs: woConfig.numTechs || "1", numDays: woConfig.numDays || "1" }))]);
  const removeSite = (i) => setSites(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

  const importCSV = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.trim().split("\n").map(l => {
          const cols = [];
          let cur = "", inQ = false;
          for (let i = 0; i < l.length; i++) {
            const ch = l[i];
            if (ch === '"' && !inQ) { inQ = true; }
            else if (ch === '"' && inQ && l[i+1] === '"') { cur += '"'; i++; }
            else if (ch === '"' && inQ) { inQ = false; }
            else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ""; }
            else { cur += ch; }
          }
          cols.push(cur.trim());
          return cols;
        });
        const dataLines = lines.slice(1).filter(cols => cols.length > 10 && cols[2]);
        // Dedupe by base building code (strip WO type suffix AND tech number)
        // e.g. FB01-LVL(1)(2) -> FB01, FB01-LVL(1) -> FB01, FB01-DEL -> FB01
        const getBaseCode = (siteId) => siteId.replace(/-[A-Z]+.*$/, "").trim();
        const seen = new Set();
        const unique = dataLines.filter(cols => {
          const base = getBaseCode(cols[2] || "");
          if (!base || seen.has(base)) return false;
          seen.add(base);
          return true;
        });
        if (unique.length === 0) { alert("No valid site rows found in this CSV."); return; }
        const imported = unique.map(cols => ({
          code:       getBaseCode(cols[2] || ""),
          branchName: "",
          address:    cols[4]  || "",
          address2:   cols[5]  || "",
          city:       cols[6]  || "",
          state:      cols[7]  || "",
          zip:        cols[8]  || "",
          date:       cols[11] || woConfig.defaultDate || "",
          numTechs:   woConfig.numTechs || "1",
          numDays:    woConfig.numDays  || "1",
          verified: null, verifying: false, verifyError: ""
        }));
        setSites(prev => {
          const existing = prev.filter(s => s.code || s.address || s.branchName);
          return existing.length > 0 ? [...existing, ...imported] : imported;
        });
        setImportMode(false);
        setPasteMode(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        alert("Failed to parse CSV: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const parsePaste = () => {
    setPasteError("");
    if (!pasteText.trim()) { setPasteError("Nothing pasted yet."); return; }

    // Pre-process: collapse quoted multiline fields into single lines
    // Handles the services sheet format where a quoted field spans multiple lines
    const collapseQuotedLines = (raw) => {
      const result = [];
      let current = "";
      let inQuote = false;
      for (const ch of raw) {
        if (ch === '"') {
          inQuote = !inQuote;
          current += ch;
        } else if (ch === "\n" && inQuote) {
          // Inside a quoted field — replace newline with space to collapse
          current += " ";
        } else if (ch === "\n" && !inQuote) {
          result.push(current);
          current = "";
        } else {
          current += ch;
        }
      }
      if (current.trim()) result.push(current);
      return result;
    };

    const rawLines = collapseQuotedLines(pasteText.trim()).filter(l => l.trim());
    if (rawLines.length === 0) { setPasteError("No data rows found."); return; }

    const siteDefaults = {
      numTechs: woConfig.numTechs || "1",
      numDays: woConfig.numDays || "1",
      verified: null, verifying: false, verifyError: ""
    };
    const parseDate = (raw) => {
      if (!raw || !raw.trim()) return woConfig.defaultDate || "";
      // MM/DD/YY or MM/DD/YYYY
      const mdyMatch = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (mdyMatch) {
        let [, m, d, y] = mdyMatch;
        if (y.length === 2) y = "20" + y;
        return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
      }
      const dt = new Date(raw);
      return !isNaN(dt) ? dt.toISOString().split("T")[0] : (woConfig.defaultDate || "");
    };

    // Detect Format 9: 3-line blocks — line1=code, line2=date, line3=address,city,ST,zip
    // Signal: first line is a bare code (no tabs/commas), second line looks like a date
    const isFormat9 = (() => {
      if (rawLines.length < 3) return false;
      const l0 = rawLines[0].trim();
      const l1 = rawLines[1].trim();
      const isBarCode = /^[A-Z0-9]{2,8}$/.test(l0);
      const isDateLike = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(l1) || /^\d{4}-\d{2}-\d{2}$/.test(l1);
      return isBarCode && isDateLike;
    })();

    let parsed;
    if (isFormat9) {
      parsed = [];
      for (let i = 0; i + 2 < rawLines.length; i += 3) {
        const code    = rawLines[i].trim();
        const date    = parseDate(rawLines[i + 1].trim());
        const addrStr = rawLines[i + 2].trim();
        const parts   = addrStr.split(",").map(p => p.trim());
        let address = parts[0] || "";
        let city    = parts[1] || "";
        let state   = "", zip = "";
        const stateZip = parts[2] || "";
        const svMatch = stateZip.match(/^([A-Z]{2})\s+(\d{5}(-\d{4})?)$/);
        if (svMatch) { state = svMatch[1]; zip = svMatch[2]; }
        else { state = stateZip; zip = parts[3] || ""; }
        parsed.push({ code, branchName: "", address, address2: "", city, state, zip, date, ...siteDefaults });
      }
    } else {

    // Detect delimiter: if first line has tabs use tab, else comma
    const delim = rawLines[0].includes("\t") ? "\t" : ",";
    const lines = rawLines.map(l => l.split(delim).map(c => c.replace(/^"|"$/g, "").trim()));

    const firstRow = lines[0].map(h => h.toLowerCase().replace(/[^a-z]/g, ""));
    const isBuildingFormat = firstRow.some(h => h === "buildingcode" || h === "buildingname");
    const HEADER_WORDS = ["code","name","address","city","state","zip","branch","building","date","site","location"];
    const isHeaderRow = (row) => {
      if (!row.length) return false;
      const first = (row[0] || "").trim().toLowerCase();
      if (/^[a-z]{1,4}\d/.test(first)) return false;
      const labelLike = row.filter(h => h.trim()).every(h => /^[a-zA-Z\s]+$/.test(h.trim()));
      const hasKnownLabel = row.some(h => HEADER_WORDS.includes(h.trim().toLowerCase()));
      return labelLike && hasKnownLabel;
    };

    // Detect Format 4 / Format 5: services sheet variants
    // Format 4: code(0) | branchName(1) | services(2) | quarter(3) | region(4) | address(5) | city(6) | state(7) | zip(8) | fullAddr(9) | status(10) | date(11)
    // Format 5: code(0) | branchName(1) | quarter(2) | region(3) | address(4) | city(5) | state(6) | zip(7) | fullAddr(8) | bool(9) | status(10) | date(11)
    // Both share: tab-delimited, 8+ cols, has quarter pattern or "Scheduled"
    const isServicesFamily = delim === "\t" && lines.length > 0 && (() => {
      const sample = lines[0];
      const hasQuarter = sample.some(c => /^\d[HhSs]\d{4}$/.test(c));
      const hasScheduled = sample.some(c => /^scheduled$/i.test(c));
      return (hasQuarter || hasScheduled) && sample.length >= 8;
    })();
    // Distinguish: Format 5 has quarter at col 2, Format 4 has services text at col 2
    const isFormat5 = isServicesFamily && /^\d[HhSs]\d{4}$/.test((lines[0] || [])[2] || "");
    const isServicesFormat = isServicesFamily && !isFormat5;


    if (isServicesFormat) {
      // Format 4: code | branchName | services | quarter | region | address | city | state | zip | fullAddr | status | date
      const dataLines = isHeaderRow(lines[0]) ? lines.slice(1) : lines;
      parsed = dataLines.map(cols => {
        let address = cols[5] || "";
        let city    = cols[6] || "";
        let state   = cols[7] || "";
        let zip     = cols[8] || "";
        let date    = parseDate(cols[11] || "");
        if (!/^\d{5}(-\d{4})?$/.test(zip)) {
          for (let ci = 5; ci < cols.length; ci++) {
            if (/^\d{5}(-\d{4})?$/.test(cols[ci])) {
              zip     = cols[ci];
              state   = cols[ci - 1] || state;
              city    = cols[ci - 2] || city;
              address = cols[ci - 3] || address;
              const lastDateCol = [...cols].reverse().find(c => /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(c));
              if (lastDateCol) date = parseDate(lastDateCol);
              break;
            }
          }
        }
        return { code: cols[0] || "", branchName: cols[1] || "", address, address2: "", city, state, zip, date, ...siteDefaults };
      });
    } else if (isFormat5) {
      // Format 5: code | branchName | quarter | region | address | city | state | zip | fullAddr | bool | status | date
      const dataLines = isHeaderRow(lines[0]) ? lines.slice(1) : lines;
      parsed = dataLines.map(cols => {
        // Fixed col positions
        let address = cols[4] || "";
        let city    = cols[5] || "";
        let state   = cols[6] || "";
        let zip     = cols[7] || "";
        let date    = parseDate(cols[11] || "");
        // Safety check: if zip looks wrong (not a zip code), scan all cols for a 5-digit zip
        if (!/^\d{5}(-\d{4})?$/.test(zip)) {
          for (let ci = 4; ci < cols.length; ci++) {
            if (/^\d{5}(-\d{4})?$/.test(cols[ci])) {
              zip     = cols[ci];
              state   = cols[ci - 1] || state;
              city    = cols[ci - 2] || city;
              address = cols[ci - 3] || address;
              // Date is last non-empty col that looks like a date
              const lastDateCol = [...cols].reverse().find(c => /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(c));
              if (lastDateCol) date = parseDate(lastDateCol);
              break;
            }
          }
        }
        return { code: cols[0] || "", branchName: cols[1] || "", address, address2: "", city, state, zip, date, ...siteDefaults };
      });
    } else if (isBuildingFormat) {
      // Format 2 (tab, with headers): buildingcode, buildingname, address, city, state, zip
      const headers = firstRow;
      const idx = (name) => headers.findIndex(h => h === name || h.includes(name));
      const iCode = idx("buildingcode"), iName = idx("buildingname");
      const iAddr = idx("address"), iCity = idx("city");
      const iState = idx("state"), iZip = idx("zip"), iDate = idx("date");
      parsed = lines.slice(1).map(cols => ({
        code:       iCode  >= 0 ? cols[iCode]  : "",
        branchName: iName  >= 0 ? cols[iName]  : "",
        address:    iAddr  >= 0 ? cols[iAddr]  : "",
        address2:   "",
        city:       iCity  >= 0 ? cols[iCity]  : "",
        state:      iState >= 0 ? cols[iState] : "",
        zip:        iZip   >= 0 ? cols[iZip]   : "",
        date:       parseDate(iDate >= 0 ? cols[iDate] : ""),
        ...siteDefaults
      }));
    } else if (delim === ",") {
      // Format 8: space-separated "CODE   branchName   address, city, ST zip"
      // Detected when first comma-part starts with a building code followed by spaces and more content
      const firstCommaCol = (lines[0] || [])[0] || "";
      const isFormat8 = /^[A-Z0-9]{2,6}\s+\S/.test(firstCommaCol.trim());
      if (isFormat8) {
        parsed = lines.map(cols => {
          // Rejoin with commas (was split on comma delimiter) then re-parse
          const full = cols.join(",");
          // Extract code: first whitespace-delimited token
          const codeMatch = full.match(/^([A-Z0-9]{2,6})\s+(.*)/);
          if (!codeMatch) return null;
          const code = codeMatch[1];
          const rest = codeMatch[2]; // "branchName   address, city, ST zip" or "address, city, ST zip"
          // Split rest on commas to find address/city/state
          const parts = rest.split(",").map(p => p.trim());
          // Last part: "ST zip" or "ST, zip"
          const lastPart = parts[parts.length - 1] || "";
          const svMatch = lastPart.match(/^([A-Z]{2})\s+(\d{5}(-\d{4})?)$/);
          let state = "", zip = "";
          if (svMatch) { state = svMatch[1]; zip = svMatch[2]; }
          else if (parts.length >= 2) { state = lastPart; zip = ""; }
          const city = parts[parts.length - 2] || "";
          // First part contains "branchName   streetAddr" — split on first digit to find street start
          const firstPart = parts[0] || "";
          const streetMatch = firstPart.match(/^(.*?)\s+(\d+\s+.+)$/);
          const branchName = streetMatch ? streetMatch[1].trim() : "";
          const address    = streetMatch ? streetMatch[2].trim() : firstPart;
          return { code, branchName, address, address2: "", city, state, zip, date: parseDate(""), ...siteDefaults };
        }).filter(Boolean);
      } else {
      // Format 3 (comma, no headers): code, name, address, city, state zip  OR  code, name, address, city, state, zip
      parsed = lines.map(cols => {
        // last field might be "CO 80260" (state+zip together) or separate
        let state = "", zip = "";
        const last = cols[cols.length - 1] || "";
        const stateZipMatch = last.match(/^([A-Z]{2})\s+(\d{5}(-\d{4})?)$/);
        if (stateZipMatch) {
          state = stateZipMatch[1];
          zip   = stateZipMatch[2];
          return {
            code:       cols[0] || "",
            branchName: cols[1] || "",
            address:    cols[2] || "",
            address2:   "",
            city:       cols[3] || "",
            state, zip,
            date:       parseDate(""),
            ...siteDefaults
          };
        } else {
          return {
            code:       cols[0] || "",
            branchName: cols[1] || "",
            address:    cols[2] || "",
            address2:   "",
            city:       cols[3] || "",
            state:      cols[4] || "",
            zip:        cols[5] || "",
            date:       parseDate(""),
            ...siteDefaults
          };
        }
      });
      }
    } else {
      const dataLines = isHeaderRow(lines[0]) ? lines.slice(1) : lines;
      // Format 6 detection first (bool at col 2) — can be 7, 8, or 11 cols
      const isFormat6 = /^(true|false)$/i.test((dataLines[0] || [])[2] || "");
      // Format 7 detection: code | [branchName |] fullAddress — 2 or 3 tab cols, last col contains commas
      const isFormat7 = !isFormat6 && (dataLines[0] || []).length <= 3 && (dataLines[0] || []).length >= 2 && ((dataLines[0] || [])[dataLines[0].length - 1] || "").includes(",");
      // Detect compact tab format (code, name, address, city, state[, zip]) — 6-7 cols
      // vs original SiteList (12+ cols with address at col 4)
      const isCompact = !isFormat6 && !isFormat7 && dataLines.length > 0 && dataLines[0].length <= 7;
      if (isFormat7) {
        // Format 7: code | [date | branchName |] "address, city, ST[, zip]"
        // col 1 may be a date (3/30/2026) or a branch name (DEN7)
        parsed = dataLines.map(cols => {
          const addrCol = cols[cols.length - 1] || "";
          const col1 = cols.length === 3 ? (cols[1] || "") : "";
          const col1IsDate = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(col1.trim()) || /^\d{4}-\d{2}-\d{2}$/.test(col1.trim());
          const branchName = col1IsDate ? "" : col1;
          const dateVal = col1IsDate ? parseDate(col1) : (woConfig.defaultDate || "");
          const parts = addrCol.split(",").map(p => p.trim());
          let address = parts[0] || "";
          let city    = parts[1] || "";
          let state   = "", zip = "";
          const stateZip = parts[2] || "";
          const svMatch = stateZip.match(/^([A-Z]{2})\s+(\d{5}(-\d{4})?)$/);
          if (svMatch) { state = svMatch[1]; zip = svMatch[2]; }
          else { state = stateZip; zip = parts[3] || ""; }
          return { code: cols[0] || "", branchName, address, address2: "", city, state, zip, date: dateVal, ...siteDefaults };
        });
      } else if (isFormat6) {
          parsed = dataLines.map(cols => ({
            code:       cols[0] || "",
            branchName: cols[1] || "",
            address:    cols[4] || "",
            address2:   "",
            city:       cols[5] || "",
            state:      cols[6] || "",
            zip:        cols[7] || "",
            date:       parseDate(cols[9] || ""),
            ...siteDefaults
          }));
      } else if (isCompact) {
          // Format 3b (tab, no headers, 6-7 cols): code, name, address, city, state, zip
          parsed = dataLines.map(cols => ({
            code:       cols[0] || "",
            branchName: cols[1] || "",
            address:    cols[2] || "",
            address2:   "",
            city:       cols[3] || "",
            state:      cols[4] || "",
            zip:        cols[5] || "",
            date:       parseDate(""),
            ...siteDefaults
          }));
      } else {
        // Format 1 (tab, original SiteList): col indices 0,1,4,5,6,7,11
        parsed = dataLines.map(cols => ({
          code:       cols[0]  || "",
          branchName: cols[1]  || "",
          address:    cols[4]  || "",
          address2:   "",
          city:       cols[5]  || "",
          state:      cols[6]  || "",
          zip:        cols[7]  || "",
          date:       parseDate(cols[11] || ""),
          ...siteDefaults
        }));
      }
    }
    } // end else (non-Format9)

    parsed = parsed.filter(s => s.code || s.address);
    if (parsed.length === 0) { setPasteError("Could not parse any rows. Make sure you copied headers too."); return; }
    setSites(prev => {
      const existing = prev.filter(s => s.code || s.address || s.branchName);
      const next = existing.length > 0 ? [...existing, ...parsed] : parsed;
      if (next.length >= 100) {
        setTimeout(() => { setEasterEgg(EASTER_EGGS[2]); setTimeout(() => setEasterEgg(null), 10000); }, 300);
      }
      return next;
    });
    setPasteMode(false);
    setPasteText("");
  };

  const parseCensusMatch = (m) => {
    const c = m.addressComponents;
    const addr = [c.fromAddress, c.preDirection, c.streetName, c.suffixType, c.suffixDirection]
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    return { address: addr, city: c.city, state: c.state, zip: c.zip };
  };

  const verifySite = async (i) => {
    const s = sites[i];
    if (!s.address) return;
    setSites(prev => prev.map((x, idx) => idx === i ? { ...x, verifying: true, verifyError: "" } : x));
    try {
      const fullAddr = [s.address, s.city, s.state, s.zip].filter(Boolean).join(", ");
      const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(fullAddr)}&benchmark=Public_AR_Current&format=json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Census ${res.status}`);
      const data = await res.json();
      const matches = data?.result?.addressMatches;
      if (!matches || matches.length === 0) throw new Error("No match found");
      const { address, city, state, zip } = parseCensusMatch(matches[0]);
      setSites(prev => prev.map((x, idx) => idx === i
        ? { ...x, verifying: false, verified: true, address: address || x.address, city: city || x.city, state: state || x.state, zip: zip || x.zip, verifyError: "" }
        : x));
    } catch (e) {
      setSites(prev => prev.map((x, idx) => idx === i ? { ...x, verifying: false, verified: false, verifyError: e.message } : x));
    }
  };

  const verifyAll = async () => {
    const toVerify = sites.map((s, i) => ({ i, s })).filter(({ s }) => s.address && s.verified !== true);
    if (toVerify.length === 0) return;
    // Mark all as verifying up front
    setSites(prev => prev.map((s, i) =>
      toVerify.find(t => t.i === i) ? { ...s, verifying: true, verifyError: "" } : s
    ));
    // Census onelineaddress supports CORS — run concurrently (cap at 5 at a time)
    const concurrency = 5;
    for (let start = 0; start < toVerify.length; start += concurrency) {
      const chunk = toVerify.slice(start, start + concurrency);
      await Promise.all(chunk.map(async ({ i, s }) => {
        try {
          const fullAddr = [s.address, s.city, s.state, s.zip].filter(Boolean).join(", ");
          const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(fullAddr)}&benchmark=Public_AR_Current&format=json`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Census ${res.status}`);
          const data = await res.json();
          const matches = data?.result?.addressMatches;
          if (!matches || matches.length === 0) throw new Error("No match found");
          const { address, city, state, zip } = parseCensusMatch(matches[0]);
          setSites(prev => prev.map((x, idx) => idx === i
            ? { ...x, verifying: false, verified: true, address: address || x.address, city: city || x.city, state: state || x.state, zip: zip || x.zip, verifyError: "" }
            : x));
        } catch (e) {
          setSites(prev => prev.map((x, idx) => idx === i
            ? { ...x, verifying: false, verified: false, verifyError: e.message } : x));
        }
      }));
    }
  };

  const handleKeyDown = (e, rowIdx, colIdx) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const next = e.shiftKey ? colIdx - 1 : colIdx + 1;
      if (next >= 0 && next < COLS.length) {
        setActiveCell({ row: rowIdx, col: next });
        inputRefs.current[`${rowIdx}-${next}`]?.focus();
      } else if (!e.shiftKey) {
        if (rowIdx + 1 >= sites.length) addRows(1);
        setTimeout(() => { setActiveCell({ row: rowIdx + 1, col: 0 }); inputRefs.current[`${rowIdx + 1}-0`]?.focus(); }, 30);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rowIdx + 1 >= sites.length) addRows(1);
      setTimeout(() => { setActiveCell({ row: rowIdx + 1, col: colIdx }); inputRefs.current[`${rowIdx + 1}-${colIdx}`]?.focus(); }, 30);
    } else if (e.key === "ArrowDown" && rowIdx + 1 < sites.length) {
      e.preventDefault(); setActiveCell({ row: rowIdx + 1, col: colIdx }); inputRefs.current[`${rowIdx + 1}-${colIdx}`]?.focus();
    } else if (e.key === "ArrowUp" && rowIdx > 0) {
      e.preventDefault(); setActiveCell({ row: rowIdx - 1, col: colIdx }); inputRefs.current[`${rowIdx - 1}-${colIdx}`]?.focus();
    }
  };

  const rowComplete = (s) => s.code && s.address && s.city && s.state && s.zip && s.date;
  const anyUnverified = sites.some(s => s.address && s.verified !== true);
  const duplicateCodes = (() => {
    const counts = {};
    sites.forEach(s => { if (s.code) counts[s.code] = (counts[s.code] || 0) + 1; });
    return new Set(Object.keys(counts).filter(k => counts[k] > 1));
  })();
  const sitesComplete = sites.every(rowComplete);

  const canProceed = [
    projectId.trim().length > 0 && !!woType,
    sitesComplete,
    true
  ];

  const downloadCSV = useCallback(async () => {
    setGenerating(true);
    try {
      const now = new Date();
      const datePart = now.toISOString().split("T")[0];
      const timePart = now.toTimeString().slice(0, 8).replace(/:/g, "-");
      const safeProject = projectId.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
      const triggerDownload = (csvContent, filename) => {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.style.display = "none";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      // Main WO CSV
      const rows = [];
      for (const site of sites) {
        rows.push(...buildRows(site, projectId, displayName, woType, woConfig, ALL_WO_TYPES));
      }
      if (rows.length && rows[rows.length-1].length === 0) rows.pop();
      const mainFilename = `FieldNation_${woType}_${safeProject}_${datePart}_${timePart}.csv`;
      const mainCsv = toCSV(WO_HEADERS, rows);
      triggerDownload(mainCsv, mainFilename);
      const csvFiles = [{ filename: mainFilename, content: mainCsv }];

      // DEL CSV when checkbox is checked
      if (includeDEL) {
        const delCfg = { ...delConfig };
        if (delCfg.templateId) saveTemplateId("DEL", delCfg.templateId, delTidLabelInput || "");
        const delRows = [];
        for (const site of sites) {
          if (!site.address && !site.code) continue;
          const siteDay1 = { ...site, numTechs: "1", numDays: "1", budgetTech: "", payRate: "", ...(delCfg.date ? { date: delCfg.date } : {}) };
          delRows.push(...buildRows(siteDay1, projectId, displayName, "DEL", delCfg, ALL_WO_TYPES));
        }
        if (delRows.length && delRows[delRows.length-1].length === 0) delRows.pop();
        if (delRows.length) {
          const delFilename = `FieldNation_DEL_${safeProject}_${datePart}_${timePart}.csv`;
          const delCsvContent = toCSV(WO_HEADERS, delRows);
          csvFiles.push({ filename: delFilename, content: delCsvContent });
          setTimeout(() => { triggerDownload(delCsvContent, delFilename); }, 500);
        }
      }
      // BRK CSV when checkbox is checked
      if (includeBRK) {
        const brkCfg = { ...brkConfig };
        if (brkCfg.templateId) saveTemplateId("BRK", brkCfg.templateId, brkTidLabelInput || "");
        const brkRows = [];
        for (const site of sites) {
          if (!site.address && !site.code) continue;
          const siteDay1 = { ...site, numTechs: "1", numDays: "1", budgetTech: "", payRate: "" };
          brkRows.push(...buildRows(siteDay1, projectId, displayName, "BRK", brkCfg, ALL_WO_TYPES));
        }
        if (brkRows.length && brkRows[brkRows.length-1].length === 0) brkRows.pop();
        if (brkRows.length) {
          const brkFilename = `FieldNation_BRK_${safeProject}_${datePart}_${timePart}.csv`;
          const brkCsvContent = toCSV(WO_HEADERS, brkRows);
          csvFiles.push({ filename: brkFilename, content: brkCsvContent });
          setTimeout(() => { triggerDownload(brkCsvContent, brkFilename); }, includeDEL ? 1000 : 500);
        }
      }
      // WRK CSV when checkbox is checked
      if (includeWRK) {
        const wrkCfg = { ...wrkConfig };
        if (wrkCfg.templateId) saveTemplateId("WRK", wrkCfg.templateId, wrkTidLabelInput || "");
        const wrkRowsData = [];
        for (const site of sites) {
          if (!site.address && !site.code) continue;
          const siteDay1 = { ...site, numTechs: "1", numDays: "1", budgetTech: "", payRate: "", ...(wrkCfg.date ? { date: wrkCfg.date } : {}) };
          wrkRowsData.push(...buildRows(siteDay1, projectId, displayName, "WRK", wrkCfg, ALL_WO_TYPES));
        }
        if (wrkRowsData.length && wrkRowsData[wrkRowsData.length-1].length === 0) wrkRowsData.pop();
        if (wrkRowsData.length) {
          const wrkFilename = `FieldNation_WRK_${safeProject}_${datePart}_${timePart}.csv`;
          const wrkCsvContent = toCSV(WO_HEADERS, wrkRowsData);
          csvFiles.push({ filename: wrkFilename, content: wrkCsvContent });
          setTimeout(() => { triggerDownload(wrkCsvContent, wrkFilename); }, (includeDEL && includeBRK) ? 1500 : (includeDEL || includeBRK) ? 1000 : 500);
        }
      }
      // Compress CSV content before storing in Supabase
      // Cap each CSV at 400KB uncompressed to stay under Supabase row limits
      const MAX_UNCOMPRESSED = 400_000;
      const filesToStore = csvFiles.filter(f => f.content.length <= MAX_UNCOMPRESSED);
      const oversized = csvFiles.length - filesToStore.length;
      if (oversized > 0) console.warn(`${oversized} CSV(s) too large to store in history (>${MAX_UNCOMPRESSED} chars), skipping.`);
      const compressedFiles = await Promise.all(
        filesToStore.map(async f => ({
          filename: f.filename,
          content: await compressString(f.content),
          compressed: true
        }))
      );
      console.log("saveJob called, files:", compressedFiles.length);
      saveJob({ csv_files: compressedFiles });
    } catch (err) {
      alert("Error: " + err.message);
    }
    setGenerating(false);
  }, [sites, projectId, displayName, woType, woConfig, includeDEL, delConfig, includeBRK, brkConfig, includeWRK, wrkConfig]);


  const totalRows = sites.filter(rowComplete).reduce((sum, site) => sum + buildRows(site, projectId, displayName, woType, woConfig, ALL_WO_TYPES).filter(r => r.length > 0).length, 0);
  const delRows = includeDEL ? sites.filter(rowComplete).length : 0;
  const brkRows = includeBRK ? sites.filter(rowComplete).length : 0;
  const wrkRows = includeWRK ? sites.filter(rowComplete).length : 0;

  const handleLogin = (e) => {
    e.preventDefault();
    const correct = import.meta.env.VITE_APP_PASSWORD;
    if (!correct || pwInput === correct) {
      saveSession({ loginTime: Date.now() });
      setAuthed(true);
      setPwError(false);
    } else {
      setPwError(true);
      setPwInput("");
    }
  };

  if (!authed) return (
    <div style={{ fontFamily: "'DM Mono','Courier New',monospace", background: dark ? "#0f0f10" : "#f4f4f5", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: dark ? "#e4e4e7" : "#18181b" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
      <div style={{ width: "100%", maxWidth: 380, padding: "2rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <img src={`data:image/png;base64,${LOGO_IMG}`} alt="Logo" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", margin: "0 auto 1rem", display: "block", border: "2px solid #e97316" }} />
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 3, color: "#e97316" }}>CHRIS PRATT</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 13, letterSpacing: 3, color: dark ? "#52525b" : "#71717a", marginTop: 2 }}>WORK ORDER GENERATOR</div>
        </div>
        <div style={{ background: dark ? "#18181b" : "#ffffff", border: `1px solid ${dark ? "#27272a" : "#e4e4e7"}`, borderRadius: 12, padding: "1.5rem" }}>
          <form onSubmit={handleLogin}>
            <label style={{ display: "block", fontSize: 10, color: dark ? "#71717a" : "#52525b", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>Password</label>
            <input
              type="password"
              value={pwInput}
              onChange={e => { setPwInput(e.target.value); setPwError(false); }}
              placeholder="Enter password"
              autoFocus
              style={{ width: "100%", background: dark ? "#111" : "#fff", border: `1px solid ${pwError ? "#ef4444" : dark ? "#3f3f46" : "#d4d4d8"}`, borderRadius: 7, padding: "10px 13px", color: dark ? "#e4e4e7" : "#18181b", fontSize: 13, fontFamily: "inherit", marginBottom: 8, outline: "none" }}
            />
            {pwError && <div style={{ color: "#ef4444", fontSize: 11, marginBottom: 8 }}>Incorrect password</div>}
            <button type="submit" style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#e97316,#dc6209)", color: "#000", fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: 2, cursor: "pointer" }}>
              ENTER
            </button>
          </form>
        </div>
        <div style={{ textAlign: "right", marginTop: 12 }}>
          <button onClick={() => setDark(d => !d)} style={{ background: "transparent", border: "none", color: dark ? "#52525b" : "#71717a", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
            {dark ? "☀ Light" : "🌙 Dark"}
          </button>
        </div>
      {null}
      </div>
    </div>
  );


  return (
    <div style={{ fontFamily: "'DM Mono','Courier New',monospace", background: T.bg, minHeight: "100vh", color: T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .tab-btn { background: transparent; border: none; padding: 10px 16px; color: ${T.tabInactive}; cursor: pointer; font-size: 12px; font-family: inherit; border-bottom: 2px solid transparent; transition: all .15s; }
        .tab-btn:hover { color: ${T.tabHover}; }
        .tab-btn.active { color: ${T.tabActive}; border-bottom-color: ${T.tabActive}; }
        .wo-card { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; border: 1.5px solid ${T.border}; background: ${T.surface}; cursor: pointer; transition: all .15s; }
        .wo-card:hover { border-color: ${T.accent}; }
        .wo-card.selected { border-color: ${T.accent}; background: ${T.cardSel}; }
      `}</style>

      {/* Header */}
      <div style={{ background: T.header, borderBottom: `2px solid ${T.accent}`, padding: "0 2rem", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", gap: 14, padding: "1.1rem 0" }}>
          <img src={`data:image/png;base64,${LOGO_IMG}`} alt="Logo"
            onClick={() => { const n = logoClickCount + 1; setLogoClickCount(n); if (n === 5) { setEasterEgg(EASTER_EGGS[4]); setTimeout(() => setEasterEgg(null), 10000); setLogoClickCount(0); } else if (n === 3) { setEasterEgg("☕ " + AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]); setTimeout(() => setEasterEgg(null), 10000); } }}
            style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `2px solid ${T.accent}`, cursor: "pointer" }} />
          <div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3, color: T.accent, lineHeight: 1 }}>CHRIS PRATT WORK ORDER GENERATOR</div>
            <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: 1.5, marginTop: 2 }}>Automated FieldNation CSV Upload</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
            {STEP_LABELS.map((label, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: i < step ? T.accent : i === step ? "transparent" : T.surface, color: i < step ? "#000" : i === step ? T.accent : T.textFaint, border: i === step ? `2px solid ${T.accent}` : "2px solid transparent", transition: "all .2s" }}>{i < step ? "✓" : i + 1}</div>
                {i < STEP_LABELS.length - 1 && <div style={{ width: 20, height: 1, background: i < step ? T.accent : T.border }} />}
              </div>
            ))}
            <button onClick={() => setDark(d => !d)} style={{ marginLeft: 12, background: "transparent", border: `1px solid ${T.border2}`, borderRadius: 20, padding: "5px 12px", color: T.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, transition: "all .15s" }}>
              {dark ? "☀ Light" : "🌙 Dark"}
            </button>
            {adminUnlocked && <button onClick={() => setShowTemplatePanel(true)} style={{ background: "transparent", border: `1px solid ${T.border2}`, borderRadius: 20, padding: "5px 12px", color: T.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>📋 Templates{woTemplates.length > 0 ? ` (${woTemplates.length})` : ""}</button>}
            <button onClick={() => setShowLibraryPanel(true)} style={{ background: "transparent", border: `1px solid ${T.border2}`, borderRadius: 20, padding: "5px 12px", color: T.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>🏗 Library{siteLibrary.length > 0 ? ` (${siteLibrary.length})` : ""}</button>
            {adminUnlocked && <button onClick={() => setShowParserPanel(true)} style={{ background: "transparent", border: `1px solid ${T.border2}`, borderRadius: 20, padding: "5px 12px", color: T.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>⚙ Parsers</button>}
            <button onClick={() => setShowHistoryPanel(true)} style={{ background: "transparent", border: `1px solid ${T.border2}`, borderRadius: 20, padding: "5px 12px", color: T.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
              📋 History{jobHistory.length > 0 ? ` (${jobHistory.length})` : ""}
            </button>
            <button onClick={() => { if (adminUnlocked) { setAdminUnlocked(false); } else { setLockPwInput(""); setLockPwError(false); setShowLockModal(true); } }} style={{ background: adminUnlocked ? "rgba(234,88,12,0.15)" : "transparent", border: `1px solid ${adminUnlocked ? T.accent : T.border2}`, borderRadius: 20, padding: "5px 12px", color: adminUnlocked ? T.accent : T.textMid, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", gap: 5 }}>
              {adminUnlocked ? "🔓" : "🔒"}
            </button>
          </div>
        {null}
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "2rem" }}>
        {/* Step title */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, letterSpacing: 2 }}>
            <span style={{ color: T.accent }}>0{step + 1} / </span>
            <span style={{ color: T.text }}>{STEP_LABELS[step]}</span>
          </div>
          <div style={{ height: 2, width: 48, background: T.accent, marginTop: 6, borderRadius: 2 }} />
        </div>


        {/* Step 0: Guided Mode */}
        {step === 0 && guidedMode && (
          <Step0Guided
            T={T} woType={woType} setWoType={setWoType} setWoConfig={setWoConfig} WO_DEFAULTS={WO_DEFAULTS} ALL_WO_TYPES={ALL_WO_TYPES} woConfig={woConfig} projectId={projectId} setProjectId={setProjectId} displayName={displayName} setDisplayName={setDisplayName} projectIdHistory={projectIdHistory} showPidDropdown={showPidDropdown} setShowPidDropdown={setShowPidDropdown} woTemplates={woTemplates} applyTemplate={applyTemplate} includeDEL={includeDEL} setIncludeDEL={setIncludeDEL} includeBRK={includeBRK} setIncludeBRK={setIncludeBRK} includeWRK={includeWRK} setIncludeWRK={setIncludeWRK} setGuidedMode={setGuidedMode} guidedMode={guidedMode} isPastDate={isPastDate}
          />
        )}

        {/* Step 0: Advanced Mode */}
        {step === 0 && !guidedMode && (
          <Step0Advanced
            T={T} woType={woType} setWoType={setWoType} setWoConfig={setWoConfig} WO_DEFAULTS={WO_DEFAULTS} ALL_WO_TYPES={ALL_WO_TYPES} WO_TYPES={WO_TYPES} woConfig={woConfig} projectId={projectId} setProjectId={setProjectId} displayName={displayName} setDisplayName={setDisplayName} projectIdHistory={projectIdHistory} showPidDropdown={showPidDropdown} setShowPidDropdown={setShowPidDropdown} displayNameHistory={displayNameHistory} showDnDropdown={showDnDropdown} setShowDnDropdown={setShowDnDropdown} woTemplates={woTemplates} setShowTemplatePanel={setShowTemplatePanel} adminUnlocked={adminUnlocked} templateIdHistory={templateIdHistory} showTidDropdown={showTidDropdown} setShowTidDropdown={setShowTidDropdown} FN_TEMPLATE_BANK={FN_TEMPLATE_BANK} saveTemplateId={saveTemplateId} includeDEL={includeDEL} setIncludeDEL={setIncludeDEL} delConfig={delConfig} setDelConfig={setDelConfig} showDelTidDropdown={showDelTidDropdown} setShowDelTidDropdown={setShowDelTidDropdown} delTidLabelInput={delTidLabelInput} setDelTidLabelInput={setDelTidLabelInput} includeBRK={includeBRK} setIncludeBRK={setIncludeBRK} brkConfig={brkConfig} setBrkConfig={setBrkConfig} showBrkTidDropdown={showBrkTidDropdown} setShowBrkTidDropdown={setShowBrkTidDropdown} brkTidLabelInput={brkTidLabelInput} setBrkTidLabelInput={setBrkTidLabelInput} includeWRK={includeWRK} setIncludeWRK={setIncludeWRK} wrkConfig={wrkConfig} setWrkConfig={setWrkConfig} showWrkTidDropdown={showWrkTidDropdown} setShowWrkTidDropdown={setShowWrkTidDropdown} wrkTidLabelInput={wrkTidLabelInput} setWrkTidLabelInput={setWrkTidLabelInput} setGuidedMode={setGuidedMode} guidedMode={guidedMode} deletedBuiltins={deletedBuiltins} setDeleteConfirm={setDeleteConfirm} setDeletePw={setDeletePw} setDeletePwError={setDeletePwError} setEditingCustomKey={setEditingCustomKey} setCustomForm={setCustomForm} setShowCustomModal={setShowCustomModal} setShowRecoverModal={setShowRecoverModal} isPastDate={isPastDate} overriddenBuiltins={overriddenBuiltins}
          />
        )}

        {/* STEP 1: Add Sites */}
        {step === 1 && (
          <div>
            <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, marginBottom: 16 }}>
              <button className={`tab-btn${pasteMode && !importMode ? " active" : ""}`} onClick={() => { setPasteMode(true); setImportMode(false); }}>⌘ Paste from Spreadsheet</button>
              <button className={`tab-btn${!pasteMode && !importMode ? " active" : ""}`} onClick={() => { setPasteMode(false); setImportMode(false); }}>✎ Edit Table ({sites.length} rows)</button>
              <button className={`tab-btn${importMode ? " active" : ""}`} onClick={() => { setImportMode(true); setPasteMode(false); }}>⬆ Import CSV</button>
              {!pasteMode && !importMode && (
                <button onClick={() => setClearConfirm(true)} style={{ marginLeft: "auto", background: "transparent", border: "1px solid #ef4444", borderRadius: 6, padding: "4px 12px", color: "#ef4444", cursor: "pointer", fontSize: 11, fontFamily: "inherit", alignSelf: "center" }}>
                  ✕ Clear All
                </button>
              )}
            </div>

            {importMode ? (
              <div style={{ padding: "2rem", textAlign: "center" }}>
                <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => importCSV(e.target.files[0])} />
                <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
                <div style={{ fontSize: 13, color: T.textDim, marginBottom: 20, lineHeight: 1.7 }}>Upload a previously exported FieldNation CSV to re-import its sites.<br/>Sites will be appended to the existing table. Branch names will be blank.</div>
                <button onClick={() => fileInputRef.current?.click()} style={{ background: `linear-gradient(135deg,${T.accent},#dc6209)`, border: "none", borderRadius: 8, padding: "12px 36px", color: "#000", cursor: "pointer", fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 2 }}>⬆ CHOOSE CSV FILE</button>
              </div>
            ) : pasteMode ? (
              <div>
                {adminUnlocked && customParsers.length > 0 && (
                  <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: T.textFaint }}>Custom parser:</span>
                    {customParsers.map(p => (
                      <button key={p.id} onClick={() => {
                        setPasteError("");
                        if (!pasteText.trim()) { setPasteError("Paste your data first, then select a parser."); return; }
                        try {
                          const delim = p.delim === "tab" ? "\t" : ",";
                          const rawLines = pasteText.trim().split("\n").filter(l => l.trim());
                          const lines = rawLines.map(l => l.split(delim).map(c => c.trim()));
                          const get = (cols, idx) => { const n = parseInt(idx); return isNaN(n) ? "" : (cols[n] || ""); };
                          const parsed = lines.filter(c => c.length > 1).map(cols => ({
                            code:       get(cols, p.colCode),
                            branchName: get(cols, p.colBranch),
                            address:    get(cols, p.colAddr),
                            address2:   "",
                            city:       get(cols, p.colCity),
                            state:      get(cols, p.colState),
                            zip:        get(cols, p.colZip),
                            date:       get(cols, p.colDate) ? (() => { const r = get(cols, p.colDate); const m = r.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if (m) { let [,mo,d,y] = m; if (y.length===2) y="20"+y; return `${y}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}`; } return r || woConfig.defaultDate || ""; })() : (woConfig.defaultDate || ""),
                            numTechs: woConfig.numTechs || "1",
                            numDays: woConfig.numDays || "1",
                            verified: null, verifying: false, verifyError: ""
                          })).filter(r => r.code || r.address);
                          if (parsed.length === 0) { setPasteError("Parser matched 0 rows — check column indices in ⚙ Parsers"); return; }
                          setSites(prev => { const ex = prev.filter(s => s.code || s.address || s.branchName); return ex.length > 0 ? [...ex, ...parsed] : parsed; });
                          setPasteMode(false); setPasteText("");
                        } catch(e) { setPasteError("Parser error: " + e.message); }
                      }} style={{ padding: "4px 12px", borderRadius: 20, border: `1px solid ${T.border2}`, background: T.surface2, color: T.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                        ⚙ {p.name}
                      </button>
                    ))}
                  </div>
                )}
                <p style={{ color: T.textDim, fontSize: 12, marginBottom: 10, lineHeight: 1.6 }}>
                  Copy rows from your SiteList and paste below. Columns: <span style={{ color: T.textMid }}>Building Code · BranchName · TargetQuarter · TimeZone · Address · City · State · ZipCode · CompleteAddress · LVV · Status · PlannedDate</span>
                </p>
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder={"Paste tab-separated rows here...\n\nFB1A\tCascade Branch\t1H2026\tMountain\t2 N Cascade Ave\tColorado Springs\tCO\t80903\t...\t...\t...\t3/30/2026"}
                  style={{ width: "100%", background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 7, padding: "10px 13px", color: T.text, fontSize: 11, fontFamily: "inherit", height: 180, resize: "vertical", lineHeight: 1.6 }}
                />
                {pasteError && <div style={{ color: "#f87171", fontSize: 11, marginTop: 6 }}>⚠ {pasteError}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button onClick={parsePaste} style={{ background: `linear-gradient(135deg,${T.accent},#dc6209)`, border: "none", borderRadius: 6, padding: "8px 20px", color: "#000", cursor: "pointer", fontSize: 12, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1.5 }}>
                    PARSE {pasteText.trim().split("\n").filter(Boolean).length} ROWS →
                  </button>
                  <button
                    disabled={aiPasteLoading || !pasteText.trim()}
                    onClick={async () => {
                      if (!pasteText.trim()) return;
                      setAiPasteLoading(true);
                      setPasteError("");
                      try {
                        const res = await fetch("/api/ai", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", "x-cpwog-secret": import.meta.env.VITE_AI_SECRET || "" },
                          body: JSON.stringify({ sampleData: pasteText.trim().slice(0, 1200) })
                        });
                        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || e.detail || `Server error ${res.status}`); }
                        const p = await res.json();
                        // Apply the mapping directly to the pasted data
                        const delim = p.delim === "tab" ? "\t" : ",";
                        const rawLines = pasteText.trim().split("\n").filter(l => l.trim());
                        const lines = rawLines.map(l => l.split(delim).map(c => c.replace(/^"|"$/g, "").trim()));
                        const get = (cols, idx) => { const n = parseInt(idx); return isNaN(n) ? "" : (cols[n] || ""); };
                        const parseD = (r) => { if (!r) return woConfig.defaultDate || ""; const m = r.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (m) { let [,mo,d,y] = m; if (y.length===2) y="20"+y; return `${y}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}`; } return r || woConfig.defaultDate || ""; };
                        const parsed = lines.filter(c => c.length > 1).map(cols => {
                          const base = { code: get(cols, p.colCode), branchName: get(cols, p.colBranch), address2: "", date: parseD(get(cols, p.colDate)), numTechs: woConfig.numTechs || "1", numDays: woConfig.numDays || "1", verified: null, verifying: false, verifyError: "" };
                          if (p.colFullAddr && !isNaN(parseInt(p.colFullAddr))) {
                            const parts = get(cols, p.colFullAddr).split(",").map(x => x.trim());
                            const last = parts[parts.length-1] || ""; const sv = last.match(/^([A-Z]{2})\s+(\d{5})$/);
                            return { ...base, address: parts[0]||"", city: parts[1]||"", state: sv ? sv[1] : (parts[2]||""), zip: sv ? sv[2] : (parts[3]||"") };
                          }
                          return { ...base, address: get(cols, p.colAddr), city: get(cols, p.colCity), state: get(cols, p.colState), zip: get(cols, p.colZip) };
                        }).filter(r => r.code || r.address);
                        if (parsed.length === 0) { setPasteError("AI couldn\'t find site data — try PARSE → instead"); setAiPasteLoading(false); return; }
                        setSites(prev => { const ex = prev.filter(s => s.code || s.address || s.branchName); return ex.length > 0 ? [...ex, ...parsed] : parsed; });
                        setPasteMode(false); setPasteText("");
                      } catch(e) { setPasteError(e.message.includes("overloaded") ? "✨ Anthropic is busy — wait a few seconds and try again" : "✨ AI Parse failed: " + e.message); }
                      setAiPasteLoading(false);
                    }}
                    style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: aiPasteLoading ? T.disabledBg : "linear-gradient(135deg,#7c3aed,#5b21b6)", color: aiPasteLoading ? T.disabledText : "#fff", cursor: aiPasteLoading || !pasteText.trim() ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                    {aiPasteLoading ? "⏳ Analyzing..." : "✨ AI Parse"}
                  </button>
                  <button onClick={() => setPasteMode(false)} style={{ background: T.disabledBg, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "8px 16px", color: T.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                    Skip — Enter Manually
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                  <p style={{ color: T.textDim, fontSize: 12, margin: 0 }}>Tab/Enter to navigate · Arrow keys move rows · Verify optional</p>
                  {showSaveLibrary && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.surface2, border: `1px solid ${T.accent}`, borderRadius: 8, padding: "8px 12px" }}>
                      <span style={{ fontSize: 11, color: T.textDim, whiteSpace: "nowrap" }}>Save as:</span>
                      <input value={librarySaveName} onChange={e => setLibrarySaveName(e.target.value)} placeholder="Project name..." style={{ ...T.inp, flex: 1 }} onFocus={e => e.target.style.borderColor=T.accent} onBlur={e => e.target.style.borderColor=T.border2} />
                      <button onClick={() => { saveToLibrary(librarySaveName); setShowSaveLibrary(false); setLibrarySaveName(""); }} disabled={!librarySaveName.trim()} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: librarySaveName.trim() ? `linear-gradient(135deg,${T.accent},#dc6209)` : T.disabledBg, color: librarySaveName.trim() ? "#000" : T.disabledText, cursor: librarySaveName.trim() ? "pointer" : "not-allowed", fontFamily: "'Bebas Neue',sans-serif", fontSize: 13, letterSpacing: 1.5 }}>SAVE</button>
                    </div>
                  )}
                  {showBulkDate && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.surface2, border: `1px solid ${T.accent}`, borderRadius: 8, padding: "8px 12px" }}>
                      <span style={{ fontSize: 11, color: T.textDim, whiteSpace: "nowrap" }}>Set all dates:</span>
                      <input type="date" value={bulkDateInput} onChange={e => setBulkDateInput(e.target.value)} style={{ ...T.inp, flex: 1 }} onFocus={e => e.target.style.borderColor=T.accent} onBlur={e => e.target.style.borderColor=T.border2} />
                      <button onClick={() => { if (!bulkDateInput) return; setSites(prev => prev.map(s => ({ ...s, date: bulkDateInput, dateOverridden: false }))); setShowBulkDate(false); setBulkDateInput(""); }} disabled={!bulkDateInput} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: bulkDateInput ? `linear-gradient(135deg,${T.accent},#dc6209)` : T.disabledBg, color: bulkDateInput ? "#000" : T.disabledText, cursor: bulkDateInput ? "pointer" : "not-allowed", fontFamily: "'Bebas Neue',sans-serif", fontSize: 13, letterSpacing: 1.5, whiteSpace: "nowrap" }}>APPLY ALL</button>
                      <button onClick={() => { setSites(prev => prev.map(s => s.date ? { ...s, date: "", dateOverridden: false } : s)); setShowBulkDate(false); setBulkDateInput(""); }} style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${T.border2}`, background: "transparent", color: T.textDim, cursor: "pointer", fontSize: 11, fontFamily: "inherit", whiteSpace: "nowrap" }}>Clear all</button>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => addRows(1)} style={{ background: T.disabledBg, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "6px 14px", color: T.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>+ Row</button>
                    <button onClick={() => addRows(5)} style={{ background: T.disabledBg, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "6px 14px", color: T.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>+ 5 Rows</button>
                    <button onClick={() => setShowBulkDate(d => !d)} style={{ background: showBulkDate ? `${T.accent}22` : T.disabledBg, border: `1px solid ${showBulkDate ? T.accent : T.border2}`, borderRadius: 6, padding: "6px 14px", color: showBulkDate ? T.accentHi : T.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>📅 Bulk Date</button>
                    <button onClick={() => { setLibrarySaveName(projectId || ""); setShowSaveLibrary(s => !s); }} style={{ background: T.disabledBg, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "6px 14px", color: T.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>🏗 Save to Library</button>
                    <button onClick={verifyAll} disabled={!anyUnverified} style={{ background: anyUnverified ? "linear-gradient(135deg,#1d4ed8,#1e40af)" : T.disabledBg, border: "none", borderRadius: 6, padding: "6px 16px", color: anyUnverified ? "#fff" : T.disabledText, cursor: anyUnverified ? "pointer" : "not-allowed", fontSize: 11, fontFamily: "inherit", fontWeight: 600 }}>✦ Verify All</button>
                  </div>
                </div>

                <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${T.border}` }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 960 }}>
                    <thead>
                      <tr style={{ background: "#111" }}>
                        <th style={{ width: 30, padding: "8px 6px", borderBottom: `2px solid ${T.border}`, color: T.textFaint, fontSize: 10 }}>#</th>
                        {COLS.map(col => (
                          <th key={col.key} style={{ width: col.width, padding: "8px 8px", borderBottom: `2px solid ${T.border}`, color: T.textDim, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, textAlign: "left", whiteSpace: "nowrap" }}>{col.label}</th>
                        ))}
                        <th style={{ width: 85, padding: "8px 6px", borderBottom: `2px solid ${T.border}`, color: T.textDim, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5 }}>Verify</th>
                        <th style={{ width: 30, borderBottom: `2px solid ${T.border}` }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sites.map((site, rowIdx) => {
                        const rowActive = activeCell.row === rowIdx;
                        const complete = rowComplete(site);
                        const isDuplicate = site.code && duplicateCodes.has(site.code);
                        const borderColor = isDuplicate ? "#f59e0b" : site.verified === true ? "#22c55e" : site.verified === false ? "#ef4444" : complete ? "#f59e0b" : "transparent";
                        return (
                          <tr key={rowIdx} style={{ background: rowActive ? T.rowHover : rowIdx % 2 === 0 ? T.surface : T.rowAlt, borderLeft: `3px solid ${borderColor}`, transition: "background .1s" }}>
                            <td style={{ padding: "4px 6px", textAlign: "center", fontSize: 11, color: T.textFaint, borderBottom: `1px solid ${T.borderRow}` }}>{rowIdx + 1}</td>
                            {COLS.map((col, colIdx) => {
                              const cellActive = rowActive && activeCell.col === colIdx;
                              const required = col.key !== "branchName" && col.key !== "address2";
                              const isEmpty = required && !site[col.key];
                              return (
                                <td key={col.key} style={{ padding: "2px 2px", borderBottom: `1px solid ${T.borderRow}`, borderRight: `1px solid ${T.border}`, background: isEmpty && !cellActive ? "rgba(239,68,68,0.04)" : "transparent" }}>
                                  <input
                                    ref={el => inputRefs.current[`${rowIdx}-${colIdx}`] = el}
                                    type={col.type || "text"}
                                    value={site[col.key]}
                                    placeholder={col.key === 'numTechs' ? (woConfig.numTechs || col.ph) : col.key === 'numDays' ? (woConfig.numDays || col.ph) : col.key === 'date' ? (woConfig.defaultDate || col.ph) : col.key === 'budgetTech' ? (woConfig.budgetTech || col.ph) : col.key === 'payRate' ? (woConfig.payRate || col.ph) : col.ph}
                                    style={{ width: "100%", background: col.key === 'date' && isPastDate(site[col.key] || (col.key === 'date' ? woConfig.defaultDate : '')) ? 'rgba(239,68,68,0.15)' : "transparent", border: "none", borderColor: col.key === 'date' && isPastDate(site[col.key] || (col.key === 'date' ? woConfig.defaultDate : '')) ? '#ef4444' : undefined, padding: "6px 8px", color: T.text, fontSize: 12, fontFamily: "inherit", outline: cellActive ? "2px solid #e97316" : "none", outlineOffset: "-1px", borderRadius: 3 }}
                                  />
                                </td>
                              );
                            })}
                            <td style={{ padding: "4px 6px", borderBottom: "1px solid #1f1f1f", textAlign: "center" }}>
                              {site.verifying ? (
                                <span style={{ fontSize: 10, color: "#f59e0b" }}>…</span>
                              ) : site.verified === true ? (
                                <span style={{ fontSize: 11, color: "#22c55e" }}>✓</span>
                              ) : site.verified === false ? (
                                <button onClick={() => verifySite(rowIdx)} title={site.verifyError} style={{ background: "#3f0000", border: "1px solid #7f1d1d", borderRadius: 5, padding: "3px 8px", color: "#f87171", cursor: "pointer", fontSize: 10, fontFamily: "inherit" }}>✗ Retry</button>
                              ) : (
                                <button onClick={() => verifySite(rowIdx)} disabled={!site.address} style={{ background: site.address ? "#1d4ed8" : T.disabledBg, border: "none", borderRadius: 5, padding: "4px 10px", color: site.address ? "#fff" : T.disabledText, cursor: site.address ? "pointer" : "default", fontSize: 10, fontFamily: "inherit" }}>Verify</button>
                              )}
                            </td>
                            <td style={{ padding: "4px 4px", borderBottom: `1px solid ${T.borderRow}`, textAlign: "center" }}>
                              <button onClick={() => removeSite(rowIdx)} style={{ background: "transparent", border: "none", color: T.border2, cursor: "pointer", fontSize: 15, lineHeight: 1, padding: "2px 4px" }} onMouseEnter={e => e.target.style.color="#ef4444"} onMouseLeave={e => e.target.style.color=T.border2}>×</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: T.textFaint }}>
                  <span>Rows: <b style={{ color: T.textMid }}>{sites.length}</b></span>
                  <span>Complete: <b style={{ color: "#22c55e" }}>{sites.filter(rowComplete).length}</b></span>
                  <span>Verified: <b style={{ color: "#22c55e" }}>{sites.filter(s => s.verified === true).length}</b></span>
                  {duplicateCodes.size > 0 && <span style={{ color: "#f59e0b" }}>⚠ {duplicateCodes.size} duplicate code{duplicateCodes.size > 1 ? "s" : ""}: {[...duplicateCodes].join(", ")}</span>}
                  {(() => { const past = sites.filter(s => isPastDate(s.date || woConfig.defaultDate)); return past.length > 0 ? <span style={{ color: "#ef4444" }}>⚠ {past.length} past date{past.length > 1 ? "s" : ""}</span> : null; })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Review & Export */}
        {step === 2 && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1.1rem" }}>
                <div style={{ fontSize: 10, color: T.textFaint, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>Project ID</div>
                <div style={{ fontSize: 12, color: T.accentHi, wordBreak: "break-word", lineHeight: 1.5 }}>{projectId}</div>
                {displayName && <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>Prefix: <span style={{ color: T.textMid }}>{displayName}</span></div>}
              </div>
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1.1rem" }}>
                <div style={{ fontSize: 10, color: T.textFaint, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>Work Order Type</div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 2, color: T.accent }}>{woType}</div>
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{ALL_WO_TYPES[woType]?.label || woType}</div>
              </div>
            </div>

            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1.1rem", marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: T.textFaint, textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>CSV Summary</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ color: T.textDim }}>Project</span>
                <span style={{ color: T.textMid }}>{projectId}{displayName ? ` — ${displayName}` : ""}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ color: T.textDim }}>WO Type</span>
                <span style={{ color: T.accentHi, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 2 }}>{woType}{includeDEL ? " + DEL" : ""}{includeBRK ? " + BRK" : ""}{includeWRK ? " + WRK" : ""}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ color: T.textDim }}>Sites</span>
                <span style={{ color: T.textMid }}>{sites.filter(rowComplete).length} sites{duplicateCodes.size > 0 ? <span style={{ color: "#f59e0b", marginLeft: 6 }}>⚠ {duplicateCodes.size} duplicate{duplicateCodes.size > 1 ? "s" : ""}</span> : ""}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ color: T.textDim }}>Date Range</span>
                <span style={{ color: T.textMid }}>{(() => { const dates = sites.filter(rowComplete).map(s => s.date).filter(Boolean).sort(); return dates.length ? (dates[0] === dates[dates.length-1] ? dates[0] : `${dates[0]} → ${dates[dates.length-1]}`) : "—"; })()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ color: T.textDim }}>Sites</span>
                <span style={{ color: T.textMid }}>{sites.filter(rowComplete).length}</span>
              </div>
              <div style={{ fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: T.textDim }}>Pattern</span>
                  <span style={{ color: T.textMid }}>{woConfig.numTechs} tech{Number(woConfig.numTechs) > 1 ? "s" : ""} × {woConfig.numDays} day{Number(woConfig.numDays) > 1 ? "s" : ""} (default)</span>
                </div>
                {(() => {
                  const overrides = sites.filter(rowComplete).filter(s =>
                    (s.numTechs && s.numTechs !== woConfig.numTechs) ||
                    (s.numDays  && s.numDays  !== woConfig.numDays)
                  );
                  if (!overrides.length) return null;
                  return (
                    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                      {overrides.map((s, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                          <span style={{ color: T.accentHi }}>↳ {s.code || s.branchName || `Site ${i+1}`}</span>
                          <span style={{ color: T.textMid }}>
                            {s.numTechs || woConfig.numTechs} tech{Number(s.numTechs || woConfig.numTechs) > 1 ? "s" : ""} × {s.numDays || woConfig.numDays} day{Number(s.numDays || woConfig.numDays) > 1 ? "s" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ color: T.textDim }}>Template ID</span>
                <span style={{ color: T.textMid }}>{woConfig.templateId}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ color: T.textDim }}>Start Time</span>
                <span style={{ color: T.textMid }}>{woConfig.startTime}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ color: T.textDim }}>Tech Type</span>
                <span style={{ color: T.textMid }}>{woConfig.techType}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ color: T.textDim }}>Budget / Pay Rate</span>
                <span style={{ color: T.textMid }}>${woConfig.budgetTech} / ${woConfig.payRate}</span>
              </div>
              {(() => {
                const rateOverrides = sites.filter(s => rowComplete(s) && (s.budgetTech || s.payRate));
                if (!rateOverrides.length) return null;
                return (
                  <div style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 10, color: T.textFaint, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>Per-site rate overrides</div>
                    {rateOverrides.map((s, i) => (
                      <div key={i} style={{ fontSize: 11, color: T.textDim, lineHeight: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: T.textMid, fontWeight: 600 }}>↳ {s.code}</span>
                        <span style={{ display: "flex", gap: 8 }}>
                          <span>Budget <span style={{ color: s.budgetTech ? T.accent : T.textFaint }}>${s.budgetTech || woConfig.budgetTech}</span></span>
                          <span>Pay <span style={{ color: s.payRate ? T.accent : T.textFaint }}>${s.payRate || woConfig.payRate}</span></span>
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingTop: 8 }}>
                <span style={{ color: T.textDim }}>Total data rows</span>
<span style={{ color: T.text, fontWeight: 600 }}>{totalRows}{delRows > 0 ? ` + ${delRows} DEL` : ""}{brkRows > 0 ? ` + ${brkRows} BRK` : ""}{wrkRows > 0 ? ` + ${wrkRows} WRK` : ""}</span>
              </div>
              {includeWRK && wrkConfig.date && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingTop: 6 }}>
                  <span style={{ color: T.textDim }}>WRK date override</span>
                  <span style={{ color: T.accent, fontWeight: 600 }}>📅 {wrkConfig.date} <span style={{ color: T.textFaint, fontWeight: 400 }}>(all sites)</span></span>
                </div>
              )}
              {includeDEL && delConfig.date && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingTop: 6 }}>
                  <span style={{ color: T.textDim }}>DEL date override</span>
                  <span style={{ color: T.accent, fontWeight: 600 }}>📅 {delConfig.date} <span style={{ color: T.textFaint, fontWeight: 400 }}>(all sites)</span></span>
                </div>
              )}
            </div>

            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1.1rem", marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: T.textFaint, textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>Sites ({sites.filter(rowComplete).length}){sites.filter(s => rowComplete(s) && (s.routeToTechs||[]).some(Boolean)).length > 0 ? <span style={{ color: T.accent, marginLeft: 8 }}>· {sites.filter(s => rowComplete(s) && (s.routeToTechs||[]).some(Boolean)).length} pre-routed 🎯</span> : ""}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 8 }}>
                {sites.map((s, realIdx) => rowComplete(s) ? (
                  <div key={realIdx} style={{ background: T.surface2, borderRadius: 6, padding: "8px 10px", borderLeft: `3px solid ${s.womId ? T.accent : s.verified === true ? "#22c55e" : T.border}` }}>
                    <div style={{ fontSize: 12, color: T.accent, fontWeight: 600 }}>{s.code}{s.branchName ? ` — ${s.branchName}` : ""}</div>
                    <div style={{ fontSize: 11, color: T.textDim, marginTop: 2, lineHeight: 1.5 }}>{s.address}{s.address2 ? `, ${s.address2}` : ""}<br />{s.city}, {s.state} {s.zip}</div>
                    <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>Start: {s.date}</div>
                    {(s.budgetTech || s.payRate) && (
                      <div style={{ fontSize: 10, color: T.accent, marginTop: 2 }}>⚡ {s.budgetTech ? `$${s.budgetTech}` : `$${woConfig.budgetTech}`} / {s.payRate ? `$${s.payRate}` : `$${woConfig.payRate}`}</div>
                    )}
                    <div style={{ marginTop: 6 }}>
                      <input
                        value={s.womId || ""}
                        onChange={e => setSites(prev => prev.map((x, xi) => xi === realIdx ? { ...x, womId: e.target.value } : x))}
                        placeholder="Work Order Manager ID"
                        style={{ width: "100%", background: s.womId ? `${T.accent}12` : T.surface, border: `1px solid ${s.womId ? T.accent : T.border2}`, borderRadius: 5, padding: "4px 8px", color: T.text, fontSize: 10, fontFamily: "inherit" }}
                        onFocus={e => e.target.style.borderColor = T.accent}
                        onBlur={e => e.target.style.borderColor = s.womId ? T.accent : T.border2}
                      />
                    </div>
                  </div>
                ) : null)}
              </div>
            </div>

            {/* Route WOs button */}
            {(() => {
              const routedCount = sites.filter(s => rowComplete(s) && (s.routeToTechs || []).some(Boolean)).length;
              return (
                <button onClick={() => setShowRoutePanel(true)} style={{ width: "100%", marginBottom: 10, padding: "10px", borderRadius: 10, border: `1px solid ${routedCount > 0 ? T.accent : T.border2}`, background: routedCount > 0 ? `${T.accent}18` : "transparent", color: routedCount > 0 ? T.accentHi : T.textMid, cursor: "pointer", fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, letterSpacing: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  🎯 {routedCount > 0 ? `ROUTE WOs  —  ${routedCount} of ${sites.filter(rowComplete).length} sites assigned` : "ROUTE WOs  —  OPTIONAL"}
                </button>
              );
            })()}
            <button onClick={downloadCSV} disabled={generating} style={{ width: "100%", padding: "1rem", borderRadius: 10, border: "none", cursor: generating ? "not-allowed" : "pointer", background: generating ? T.disabledBg : `linear-gradient(135deg,${T.accent},#dc6209)`, color: generating ? T.disabledText : "#000", fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3, transition: "all .2s", boxShadow: generating ? "none" : "0 4px 24px rgba(234,88,12,.35)" }}>
              {generating ? "⏳  BUILDING CSV..." : (includeDEL || includeBRK || includeWRK) ? `⬇  DOWNLOAD ${woType}${includeDEL ? " + DEL" : ""}${includeBRK ? " + BRK" : ""}${includeWRK ? " + WRK" : ""} CSVs` : `⬇  DOWNLOAD ${woType} CSV`}
            </button>
            <div style={{ fontSize: 11, color: T.textFaint, textAlign: "center", marginTop: 8 }}>
              Single CSV file · Ready to upload directly to FieldNation
            </div>
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button onClick={() => setStartOverConfirm(true)} style={{ background: "transparent", border: `1px solid ${T.border2}`, borderRadius: 8, padding: "8px 24px", color: T.textDim, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                ↩ Start Over
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, gap: 12 }}>
          {step > 0
            ? <button onClick={() => setStep(s => { setJoke(JOKES[Math.floor(Math.random() * JOKES.length)]); return s - 1; })} style={{ background: T.btnBack, border: `1px solid ${T.border2}`, borderRadius: 8, padding: "10px 22px", color: T.textMid, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>← Back</button>
            : <div />}
          {step < 2 && (
            <button onClick={() => { if (step === 0) { handleContinueStep0(); } else { setStep(s => { setJoke(JOKES[Math.floor(Math.random() * JOKES.length)]); return s + 1; }); } }} disabled={!canProceed[step]}
              style={{ background: canProceed[step] ? `linear-gradient(135deg,${T.accent},#dc6209)` : T.disabledBg, border: "none", borderRadius: 8, padding: "10px 28px", color: canProceed[step] ? "#000" : T.disabledText, cursor: canProceed[step] ? "pointer" : "not-allowed", fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: 2, boxShadow: canProceed[step] ? "0 2px 14px rgba(234,88,12,.4)" : "none", transition: "all .15s" }}>
              Continue →
            </button>
          )}
        </div>

        {/* Start Over modal */}
        {startOverConfirm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 14, padding: "1.75rem", width: "100%", maxWidth: 380, margin: "0 1rem" }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 2, color: T.accent, marginBottom: 8 }}>START OVER?</div>
              <div style={{ fontSize: 13, color: T.textMid, marginBottom: 20, lineHeight: 1.6 }}>
                Go back to Step 1 and run another batch. Keep your sites or clear everything?
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={() => {
                  setStep(0);
                  setStartOverConfirm(false);
                }} style={{ padding: "10px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${T.accent},#dc6209)`, color: "#000", fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, letterSpacing: 2, cursor: "pointer" }}>
                  KEEP DATA &amp; START OVER
                </button>
                <button onClick={() => {
                  setStep(0);
                  setProjectId("");
                  setDisplayName("");
                  setWoType("LVL");
                  setWoConfig({ ...WO_DEFAULTS["LVL"] });
                  setSites([{ ...EMPTY_SITE(), date: "", numTechs: "1", numDays: "1" }]);
                  setStartOverConfirm(false);
                }} style={{ padding: "10px", borderRadius: 8, border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, letterSpacing: 2, cursor: "pointer" }}>
                  CLEAR ALL &amp; START OVER
                </button>
                <button onClick={() => setStartOverConfirm(false)} style={{ padding: "8px", borderRadius: 8, border: `1px solid ${T.border2}`, background: "transparent", color: T.textMid, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                  Cancel
                </button>
              </div>
            {null}
            </div>
          </div>
        )}

        {/* Clear All confirmation modal */}
        {clearConfirm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: T.surface, border: "1px solid #ef4444", borderRadius: 14, padding: "1.75rem", width: "100%", maxWidth: 360, margin: "0 1rem" }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 2, color: "#ef4444", marginBottom: 8 }}>CLEAR ALL SITES?</div>
              <div style={{ fontSize: 13, color: T.textMid, marginBottom: 20, lineHeight: 1.6 }}>
                This will delete all <strong style={{ color: T.text }}>{sites.length} row{sites.length !== 1 ? "s" : ""}</strong> from the table. This cannot be undone.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setSites([{ ...EMPTY_SITE(), date: woConfig.defaultDate || "", numTechs: woConfig.numTechs || "1", numDays: woConfig.numDays || "1" }]); setClearConfirm(false); }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, letterSpacing: 2, cursor: "pointer" }}>
                  YES, CLEAR ALL
                </button>
                <button onClick={() => setClearConfirm(false)} style={{ padding: "10px 18px", borderRadius: 8, border: `1px solid ${T.border2}`, background: "transparent", color: T.textMid, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                  Cancel
                </button>
              </div>
            {null}
            </div>
          </div>
        )}

        {/* Job History panel */}
        {/* ── Template Panel ──────────────────────────────────────────────── */}
        {showTemplatePanel && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 400, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }} onClick={() => setShowTemplatePanel(false)}>
            <div style={{ background: T.surface, borderLeft: `2px solid ${T.accent}`, height: "100%", width: "100%", maxWidth: 460, overflowY: "auto", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, background: T.surface, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3, color: T.accentHi }}>📋 WO TEMPLATES</div>
                  <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>Save your full WO config as a reusable template</div>
                </div>
                <button onClick={() => setShowTemplatePanel(false)} style={{ background: "transparent", border: "none", color: T.textMid, cursor: "pointer", fontSize: 20 }}>✕</button>
              </div>
              {/* Save current as template */}
              <div style={{ padding: "1rem 1.5rem", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, color: T.textDim, marginBottom: 8 }}>Save current config ({woType}{includeDEL ? " + DEL" : ""}{includeBRK ? " + BRK" : ""}{includeWRK ? " + WRK" : ""}) as a template:</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={templateSaveName} onChange={e => setTemplateSaveName(e.target.value)} placeholder="Template name (e.g. PNC LVV Standard)" style={{ ...T.inp, flex: 1 }} onFocus={e => e.target.style.borderColor=T.accent} onBlur={e => e.target.style.borderColor=T.border2} onKeyDown={e => { if (e.key === "Enter" && templateSaveName.trim()) { saveCurrentAsTemplate(templateSaveName); setTemplateSaveName(""); }}} />
                  <button onClick={() => { if (templateSaveName.trim()) { saveCurrentAsTemplate(templateSaveName); setTemplateSaveName(""); }}} disabled={!templateSaveName.trim()} style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: templateSaveName.trim() ? `linear-gradient(135deg,${T.accent},#dc6209)` : T.disabledBg, color: templateSaveName.trim() ? "#000" : T.disabledText, cursor: templateSaveName.trim() ? "pointer" : "not-allowed", fontFamily: "'Bebas Neue',sans-serif", fontSize: 13, letterSpacing: 1.5 }}>SAVE</button>
                </div>
              </div>
              {/* Template list */}
              <div style={{ flex: 1, padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: 8 }}>
                {woTemplates.length === 0 && <div style={{ color: T.textFaint, fontSize: 13, textAlign: "center", marginTop: 30 }}>No templates yet — save your current config above.</div>}
                {woTemplates.map(tpl => (
                  <div key={tpl.id} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "0.9rem 1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, letterSpacing: 2, color: T.accentHi }}>{tpl.name}</div>
                      <button onClick={() => saveWoTemplates(woTemplates.filter(t => t.id !== tpl.id))} style={{ background: "transparent", border: "1px solid #ef4444", borderRadius: 5, padding: "2px 8px", color: "#ef4444", cursor: "pointer", fontSize: 10 }}>✕</button>
                    </div>
                    <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.7, marginBottom: 8 }}>
                      {tpl.woType}{tpl.includeDEL ? " + DEL" : ""}{tpl.includeBRK ? " + BRK" : ""}{tpl.includeWRK ? " + WRK" : ""}
                      {tpl.woConfig?.templateId ? ` · Template ${tpl.woConfig.templateId}` : ""}
                      {tpl.woConfig?.defaultDate ? ` · ${tpl.woConfig.defaultDate}` : ""}
                    </div>
                    <button onClick={() => applyTemplate(tpl)} style={{ width: "100%", padding: "7px", borderRadius: 7, border: "none", background: `linear-gradient(135deg,${T.accent},#dc6209)`, color: "#000", cursor: "pointer", fontFamily: "'Bebas Neue',sans-serif", fontSize: 13, letterSpacing: 1.5 }}>↩ APPLY TEMPLATE</button>
                  </div>
                ))}
              </div>
            {null}
            </div>
          </div>
        )}

        {/* ── Site Library Panel ──────────────────────────────────────────────── */}
        {showLibraryPanel && (() => {
          const filteredLib = siteLibrary.filter(l => !librarySearch.trim() || (l.project_name||"").toLowerCase().includes(librarySearch.toLowerCase()) || (l.sites||[]).some(s => (s.code||"").toLowerCase().includes(librarySearch.toLowerCase()) || (s.branchName||"").toLowerCase().includes(librarySearch.toLowerCase())));
          const selCount = libSelected.size;
          const addSelected = () => {
            const toAdd = [];
            libSelected.forEach(key => {
              const [eid, sidx] = key.split(":");
              const entry = siteLibrary.find(e => String(e.id) === eid);
              if (entry?.sites?.[+sidx]) toAdd.push(entry.sites[+sidx]);
            });
            const loaded = toAdd.map(s => ({ ...EMPTY_SITE(), ...s, numTechs: woConfig.numTechs||"1", numDays: woConfig.numDays||"1", date: s.date||woConfig.defaultDate||"", verified: null, verifying: false, verifyError: "" }));
            setSites(prev => { const ex = prev.filter(s => s.code||s.address||s.branchName); return ex.length > 0 ? [...ex, ...loaded] : loaded; });
            setLibSelected(new Set()); setShowLibraryPanel(false);
          };
          return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 400, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }} onClick={() => { setShowLibraryPanel(false); setLibSelected(new Set()); }}>
            <div style={{ background: T.surface, borderLeft: `2px solid ${T.accent}`, height: "100%", width: "100%", maxWidth: 480, display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, background: T.surface, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3, color: T.accentHi }}>🏗 SITE LIBRARY</div>
                  <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>Check sites to select · Shift+click for range · Ctrl+click individual</div>
                </div>
                <button onClick={() => { setShowLibraryPanel(false); setLibSelected(new Set()); }} style={{ background: "transparent", border: "none", color: T.textMid, cursor: "pointer", fontSize: 20 }}>✕</button>
              </div>

              {/* Search */}
              <div style={{ padding: "0.75rem 1.5rem", borderBottom: `1px solid ${T.border}`, background: T.surface }}>
                <input placeholder="Search by project, code, or branch name..." value={librarySearch} onChange={e => setLibrarySearch(e.target.value)} style={{ ...T.inp, width: "100%" }} />
              </div>

              {/* Project list */}
              <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem 1.5rem", display: "flex", flexDirection: "column", gap: 8 }}>
                {siteLibrary.length === 0 && <div style={{ color: T.textFaint, fontSize: 13, textAlign: "center", marginTop: 40 }}>No saved site lists yet.<br/>Go to Add Sites → Edit Table → 🏗 Save to Library.</div>}
                {filteredLib.map(entry => {
                  const eid = String(entry.id);
                  const sites = entry.sites || [];
                  const isExpanded = libExpanded.has(eid);
                  const entryKeys = sites.map((_, i) => `${eid}:${i}`);
                  const allSelected = entryKeys.length > 0 && entryKeys.every(k => libSelected.has(k));
                  const someSelected = entryKeys.some(k => libSelected.has(k));
                  const filteredSites = librarySearch.trim()
                    ? sites.filter(s => (s.code||"").toLowerCase().includes(librarySearch.toLowerCase()) || (s.branchName||"").toLowerCase().includes(librarySearch.toLowerCase()) || (s.address||"").toLowerCase().includes(librarySearch.toLowerCase()))
                    : sites;

                  return (
                    <div key={eid} style={{ background: T.surface2, border: `1px solid ${someSelected ? T.accent : T.border}`, borderRadius: 10, overflow: "hidden" }}>
                      {/* Project header row */}
                      <div style={{ padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                        {/* Select-all checkbox for this project */}
                        <div onClick={e => { e.stopPropagation(); const next = new Set(libSelected); if (allSelected) entryKeys.forEach(k => next.delete(k)); else entryKeys.forEach(k => next.add(k)); setLibSelected(next); }}
                          style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${allSelected ? T.accent : someSelected ? T.accent : T.border2}`, background: allSelected ? T.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
                          {allSelected && <span style={{ color: "#000", fontSize: 11, fontWeight: 700 }}>✓</span>}
                          {someSelected && !allSelected && <div style={{ width: 8, height: 2, background: T.accent, borderRadius: 1 }} />}
                        </div>
                        {/* Project info — click to expand */}
                        <div style={{ flex: 1 }} onClick={() => { const next = new Set(libExpanded); if (isExpanded) next.delete(eid); else next.add(eid); setLibExpanded(next); }}>
                          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 14, letterSpacing: 1.5, color: someSelected ? T.accentHi : T.textMid }}>{entry.project_name}</div>
                          <div style={{ fontSize: 10, color: T.textFaint }}>{sites.length} sites · {new Date(entry.created_at).toLocaleDateString()} {someSelected ? `· ${entryKeys.filter(k => libSelected.has(k)).length} selected` : ""}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <button onClick={e => { e.stopPropagation(); deleteFromLibrary(entry.id); }} style={{ background: "transparent", border: "1px solid #ef4444", borderRadius: 5, padding: "2px 7px", color: "#ef4444", cursor: "pointer", fontSize: 10 }}>✕</button>
                          <span onClick={() => { const next = new Set(libExpanded); if (isExpanded) next.delete(eid); else next.add(eid); setLibExpanded(next); }} style={{ color: T.textFaint, cursor: "pointer", fontSize: 12 }}>{isExpanded ? "▾" : "▸"}</span>
                        </div>
                      </div>

                      {/* Site list — shown when expanded */}
                      {isExpanded && (
                        <div style={{ borderTop: `1px solid ${T.border}` }}>
                          {filteredSites.map((site, fi) => {
                            const realIdx = sites.indexOf(site);
                            const key = `${eid}:${realIdx}`;
                            const checked = libSelected.has(key);
                            return (
                              <div key={realIdx}
                                onClick={e => {
                                  const next = new Set(libSelected);
                                  if (e.shiftKey && libLastClick && libLastClick.eid === eid) {
                                    // Range select within this project
                                    const from = Math.min(libLastClick.idx, realIdx);
                                    const to = Math.max(libLastClick.idx, realIdx);
                                    for (let i = from; i <= to; i++) next.add(`${eid}:${i}`);
                                  } else {
                                    if (checked) next.delete(key); else next.add(key);
                                  }
                                  setLibSelected(next);
                                  setLibLastClick({ eid, idx: realIdx });
                                }}
                                style={{ padding: "7px 1rem 7px 2.5rem", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: checked ? `${T.accent}10` : "transparent", borderBottom: `1px solid ${T.border}` }}
                                onMouseEnter={e => e.currentTarget.style.background = checked ? `${T.accent}18` : T.rowHover}
                                onMouseLeave={e => e.currentTarget.style.background = checked ? `${T.accent}10` : "transparent"}
                              >
                                <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${checked ? T.accent : T.border2}`, background: checked ? T.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  {checked && <span style={{ color: "#000", fontSize: 10, fontWeight: 700 }}>✓</span>}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ fontSize: 12, color: checked ? T.accentHi : T.text, fontWeight: 600 }}>{site.code}</span>
                                  {site.branchName && <span style={{ fontSize: 11, color: T.textDim, marginLeft: 8 }}>{site.branchName}</span>}
                                  <div style={{ fontSize: 10, color: T.textFaint, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{site.address}, {site.city}, {site.state} {site.zip}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Sticky footer */}
              <div style={{ padding: "1rem 1.5rem", borderTop: `1px solid ${T.border}`, background: T.surface, display: "flex", gap: 8 }}>
                <button onClick={() => { setLibSelected(new Set()); }} style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${T.border2}`, background: "transparent", color: T.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit", whiteSpace: "nowrap" }}>Clear</button>
                <button
                  disabled={selCount === 0}
                  onClick={addSelected}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: selCount > 0 ? `linear-gradient(135deg,${T.accent},#dc6209)` : T.disabledBg, color: selCount > 0 ? "#000" : T.disabledText, cursor: selCount > 0 ? "pointer" : "not-allowed", fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: 2 }}>
                  {selCount > 0 ? `↩ ADD ${selCount} SITE${selCount > 1 ? "S" : ""}` : "SELECT SITES ABOVE"}
                </button>
              </div>

            </div>
          </div>
          );
        })()}

        {/* ── Parser Panel ─────────────────────────────────────────────── */}
        {showParserPanel && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 400, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }} onClick={() => { setShowParserPanel(false); setEditingParser(null); setParserPreview([]); setParserPreviewError(""); }}>
            <div style={{ background: T.surface, borderLeft: `2px solid ${T.accent}`, height: "100%", width: "100%", maxWidth: 560, overflowY: "auto", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, background: T.surface, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3, color: T.accentHi }}>⚙ PASTE PARSERS</div>
                  <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>Built-in parsers are read-only · Create custom parsers below</div>
                </div>
                <button onClick={() => { setShowParserPanel(false); setEditingParser(null); setParserPreview([]); }} style={{ background: "transparent", border: "none", color: T.textMid, cursor: "pointer", fontSize: 20 }}>✕</button>
              </div>

              <div style={{ flex: 1, padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Built-in parsers */}
                <div>
                  <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>Built-in Parsers (read-only)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {BUILTIN_PARSERS.map(p => (
                      <div key={p.id} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 13, letterSpacing: 1.5, color: T.textMid }}>{p.name}</div>
                          <div style={{ fontSize: 10, color: T.textFaint, background: T.surface, borderRadius: 4, padding: "2px 8px" }}>BUILT-IN</div>
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint, lineHeight: 1.6 }}>
                          <span style={{ color: T.textDim }}>Delim:</span> {p.delim} &nbsp;·&nbsp; <span style={{ color: T.textDim }}>Cols:</span> {p.cols}<br/>
                          <span style={{ color: T.textDim }}>Detected by:</span> {p.signal}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom parsers */}
                <div>
                  <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>Custom Parsers ({customParsers.length})</div>
                  {customParsers.length === 0 && (
                    <div style={{ fontSize: 12, color: T.textFaint, fontStyle: "italic", marginBottom: 10 }}>No custom parsers yet — create one below</div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                    {customParsers.map((p, pi) => (
                      <div key={p.id} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 13, letterSpacing: 1.5, color: T.accentHi }}>{p.name}</div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => { setEditingParser(p.id); setParserForm({ ...p }); setParserPreview([]); }} style={{ background: "transparent", border: `1px solid ${T.border2}`, borderRadius: 5, padding: "2px 10px", color: T.textDim, cursor: "pointer", fontSize: 10 }}>edit</button>
                            <button onClick={() => { const next = customParsers.filter(x => x.id !== p.id); saveCustomParsers(next); }} style={{ background: "transparent", border: "1px solid #ef4444", borderRadius: 5, padding: "2px 10px", color: "#ef4444", cursor: "pointer", fontSize: 10 }}>✕</button>
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint, lineHeight: 1.6 }}>
                          Delim: {p.delim} &nbsp;·&nbsp; Code col: {p.colCode}{p.colFullAddr ? ` · Full addr col: ${p.colFullAddr}` : ` · Addr: ${p.colAddr} · City: ${p.colCity} · ST: ${p.colState} · ZIP: ${p.colZip}`}{p.colDate ? ` · Date: ${p.colDate}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Create / Edit form */}
                  <div style={{ background: T.surface, border: `1px solid ${editingParser ? T.accent : T.border}`, borderRadius: 10, padding: "1rem" }}>
                    <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>{editingParser ? "Edit Custom Parser" : "New Custom Parser"}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div style={{ gridColumn: "span 2" }}>
                        <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Parser Name</label>
                        <input style={T.inp} placeholder="e.g. Acme Site Export" value={parserForm.name || ""} onChange={e => setParserForm(p => ({ ...p, name: e.target.value }))} onFocus={e => e.target.style.borderColor=T.accent} onBlur={e => e.target.style.borderColor=T.border2} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Delimiter</label>
                        <div style={{ display: "flex", gap: 6 }}>
                          {["tab", "comma"].map(d => (
                            <button key={d} onClick={() => setParserForm(p => ({ ...p, delim: d }))} style={{ flex: 1, padding: "8px", borderRadius: 7, border: `2px solid ${parserForm.delim === d ? T.accent : T.border2}`, background: parserForm.delim === d ? `${T.accent}22` : "transparent", color: parserForm.delim === d ? T.accentHi : T.textMid, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{d}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Detection Signal (optional)</label>
                        <input style={T.inp} placeholder="e.g. col 3 = Region" value={parserForm.signal || ""} onChange={e => setParserForm(p => ({ ...p, signal: e.target.value }))} onFocus={e => e.target.style.borderColor=T.accent} onBlur={e => e.target.style.borderColor=T.border2} />
                      </div>
                      {[
                        { key: "colCode",   label: "Code Column #",    ph: "0" },
                        { key: "colBranch", label: "Branch Name Col #", ph: "1" },
                        { key: "colAddr",   label: "Address Column #",  ph: "2", hint: "Use this OR Full Address Col below" },
                        { key: "colCity",   label: "City Column #",     ph: "3" },
                        { key: "colState",  label: "State Column #",    ph: "4" },
                        { key: "colZip",    label: "ZIP Column #",      ph: "5" },
                        { key: "colDate",   label: "Date Column # (opt)",ph: "" },
                        { key: "colFullAddr", label: "Full Address Col # (opt)", ph: "", hint: "If addr/city/state/zip are in one column like '123 Main, Denver, CO, 80201'" },
                      ].map(({ key, label, ph, hint }) => (
                        <div key={key}>
                          <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{label}</label>
                          <input style={T.inp} placeholder={ph} value={parserForm[key] || ""} onChange={e => setParserForm(p => ({ ...p, [key]: e.target.value }))} onFocus={e => e.target.style.borderColor=T.accent} onBlur={e => e.target.style.borderColor=T.border2} />
                          {hint && <div style={{ fontSize: 10, color: T.textFaint, marginTop: 3 }}>{hint}</div>}
                        </div>
                      ))}
                    </div>

                    {/* Sample data + preview */}
                    <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Sample Data (paste a few rows to test)</label>
                    <textarea
                      value={parserForm.sampleData || ""}
                      onChange={e => setParserForm(p => ({ ...p, sampleData: e.target.value }))}
                      placeholder={"Paste sample rows here to preview how they'll parse..."}
                      style={{ width: "100%", background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 7, padding: "8px 12px", color: T.text, fontSize: 11, fontFamily: "inherit", height: 100, resize: "vertical", lineHeight: 1.6, marginBottom: 8 }}
                    />
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      <button onClick={() => runParserPreview(parserForm)} style={{ flex: 1, padding: "7px", borderRadius: 7, border: `1px solid ${T.border2}`, background: T.surface2, color: T.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>▶ Preview Parse</button>
                      <button onClick={generateParserWithAI} disabled={aiParserLoading || !parserForm.sampleData?.trim()} style={{ flex: 1, padding: "7px", borderRadius: 7, border: "none", background: aiParserLoading ? T.disabledBg : "linear-gradient(135deg,#7c3aed,#5b21b6)", color: aiParserLoading ? T.disabledText : "#fff", cursor: aiParserLoading || !parserForm.sampleData?.trim() ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        {aiParserLoading ? "⏳ Analyzing..." : "✨ AI Detect"}
                      </button>
                    </div>
                    {aiParserError && <div style={{ fontSize: 11, color: "#f87171", marginBottom: 8 }}>⚠ {aiParserError}</div>}

                    {parserPreviewError && <div style={{ fontSize: 11, color: "#f87171", marginBottom: 8 }}>⚠ {parserPreviewError}</div>}
                    {parserPreview.length > 0 && (
                      <div style={{ background: T.surface2, borderRadius: 7, padding: "8px 10px", marginBottom: 10, fontSize: 11, color: T.textDim }}>
                        <div style={{ fontWeight: 600, color: "#22c55e", marginBottom: 6 }}>✓ {parserPreview.length} row{parserPreview.length > 1 ? "s" : ""} parsed</div>
                        {parserPreview.slice(0, 3).map((r, i) => (
                          <div key={i} style={{ borderTop: `1px solid ${T.border}`, paddingTop: 4, marginTop: 4, lineHeight: 1.8 }}>
                            <span style={{ color: T.accent }}>{r.code}</span> · {r.address}, {r.city}, {r.state} {r.zip}{r.date ? ` · ${r.date}` : ""}
                          </div>
                        ))}
                        {parserPreview.length > 3 && <div style={{ color: T.textFaint, marginTop: 4 }}>+{parserPreview.length - 3} more</div>}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8 }}>
                      {editingParser && <button onClick={() => { setEditingParser(null); setParserForm({ name: "", delim: "tab", signal: "", sampleData: "", colCode: "0", colBranch: "1", colAddr: "2", colCity: "3", colState: "4", colZip: "5", colDate: "", colFullAddr: "" }); setParserPreview([]); }} style={{ flex: 1, padding: "9px", borderRadius: 8, border: `1px solid ${T.border2}`, background: "transparent", color: T.textMid, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Cancel</button>}
                      <button
                        disabled={!parserForm.name?.trim()}
                        onClick={() => {
                          const id = editingParser || `custom_${Date.now()}`;
                          const entry = { ...parserForm, id };
                          const next = editingParser
                            ? customParsers.map(p => p.id === editingParser ? entry : p)
                            : [...customParsers, entry];
                          saveCustomParsers(next);
                          setEditingParser(null);
                          setParserForm({ name: "", delim: "tab", signal: "", sampleData: "", colCode: "0", colBranch: "1", colAddr: "2", colCity: "3", colState: "4", colZip: "5", colDate: "", colFullAddr: "" });
                          setParserPreview([]);
                        }}
                        style={{ flex: 2, padding: "9px", borderRadius: 8, border: "none", background: parserForm.name?.trim() ? `linear-gradient(135deg,${T.accent},#dc6209)` : T.disabledBg, color: parserForm.name?.trim() ? "#000" : T.disabledText, cursor: parserForm.name?.trim() ? "pointer" : "not-allowed", fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, letterSpacing: 2 }}>
                        {editingParser ? "SAVE CHANGES" : "SAVE PARSER"}
                      </button>
                    </div>
                  {null}
                  </div>
                {null}
                </div>
              {null}
              </div>
            {null}
            </div>
          </div>
        )}

        {showHistoryPanel && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 400, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }} onClick={() => setShowHistoryPanel(false)}>
            <div style={{ background: T.surface, borderLeft: `2px solid ${T.accent}`, height: "100%", width: "100%", maxWidth: 480, overflowY: "auto", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: T.surface, zIndex: 1 }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3, color: T.accentHi }}>📋 JOB HISTORY</div>
                <button onClick={() => setShowHistoryPanel(false)} style={{ background: "transparent", border: "none", color: T.textMid, cursor: "pointer", fontSize: 20 }}>✕</button>
              </div>
              <div style={{ padding: "0.75rem 1.5rem", borderBottom: `1px solid ${T.border}`, position: "sticky", top: 58, background: T.surface, zIndex: 1 }}>
                <input
                  placeholder="Search by project, type, display name..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  style={{ ...T.inp, width: "100%" }}
                />
              </div>
              <div style={{ flex: 1, padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: 10 }}>
                {jobHistory.length === 0 && (
                  <div style={{ color: T.textFaint, fontSize: 13, textAlign: "center", marginTop: 40 }}>No jobs saved yet.<br/>Download a CSV to record your first job.</div>
                )}
                {jobHistory
                  .filter(j => {
                    if (!historySearch.trim()) return true;
                    const q = historySearch.toLowerCase();
                    return (j.project_id || "").toLowerCase().includes(q) ||
                           (j.display_name || "").toLowerCase().includes(q) ||
                           (j.wo_type || "").toLowerCase().includes(q);
                  })
                  .map(job => (
                    <div key={job.id} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1rem", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div>
                          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, letterSpacing: 2, color: T.accentHi }}>{job.wo_type} — {job.project_id}</div>
                          {job.display_name && <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>{job.display_name}</div>}
                        </div>
                        <div style={{ fontSize: 10, color: T.textFaint, whiteSpace: "nowrap", flexShrink: 0 }}>{new Date(job.created_at).toLocaleString()}</div>
                      </div>
                      <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.8 }}>
                        <span style={{ color: T.textMid }}>{job.site_count}</span> sites
                        {job.wo_config?.templateId && <> · Template <span style={{ color: T.textMid }}>{job.wo_config.templateId}</span></>}
                        {job.wo_config?.defaultDate && <> · Date <span style={{ color: T.textMid }}>{job.wo_config.defaultDate}</span></>}
                        {job.wo_config?.payType && <> · <span style={{ color: T.textMid }}>{job.wo_config.payType}</span></>}
                        {job.include_del && <> · <span style={{ color: T.accent }}>+ DEL</span></>}
                        {job.include_brk && <> · <span style={{ color: T.accent }}>+ BRK</span></>}
                        {job.include_wrk && <> · <span style={{ color: T.accent }}>+ WRK</span></>}
                      </div>
                      {/* Re-download stored CSVs */}
                      {Array.isArray(job.csv_files) && job.csv_files.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {job.csv_files.map((f, fi) => (
                            <button key={fi} onClick={async () => {
                              const content = f.compressed ? await decompressString(f.content) : f.content;
                              const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url; a.download = f.filename; a.style.display = "none";
                              document.body.appendChild(a); a.click(); document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${T.border2}`, background: T.surface, color: T.textMid, cursor: "pointer", fontSize: 10, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                              ⬇ {f.filename.replace(/^FieldNation_/, "").replace(/_\d{4}-\d{2}-\d{2}_.*$/, "")}
                            </button>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => {
                          setProjectId(job.project_id || "");
                          setDisplayName(job.display_name || "");
                          setWoType(job.wo_type || "LVL");
                          setWoConfig(job.wo_config || { ...BLANK_CFG });
                          if (job.include_del && job.del_config) { setIncludeDEL(true); setDelConfig(job.del_config); } else { setIncludeDEL(false); }
                          if (job.include_brk && job.brk_config) { setIncludeBRK(true); setBrkConfig(job.brk_config); } else { setIncludeBRK(false); }
                          if (job.include_wrk && job.wrk_config) { setIncludeWRK(true); setWrkConfig(job.wrk_config); } else { setIncludeWRK(false); }
                          if (Array.isArray(job.sites) && job.sites.length) setSites(job.sites);
                          setStep(0);
                          setShowHistoryPanel(false);
                        }} style={{ flex: 1, padding: "7px", borderRadius: 7, border: "none", background: `linear-gradient(135deg,${T.accent},#dc6209)`, color: "#000", cursor: "pointer", fontFamily: "'Bebas Neue',sans-serif", fontSize: 13, letterSpacing: 1.5 }}>↩ RESTORE JOB</button>
                        <button onClick={() => {
                          setProjectId(job.project_id || "");
                          setDisplayName(job.display_name || "");
                          setWoType(job.wo_type || "LVL");
                          setWoConfig(job.wo_config || { ...BLANK_CFG });
                          if (job.include_del && job.del_config) { setIncludeDEL(true); setDelConfig(job.del_config); } else { setIncludeDEL(false); }
                          if (job.include_brk && job.brk_config) { setIncludeBRK(true); setBrkConfig(job.brk_config); } else { setIncludeBRK(false); }
                          if (job.include_wrk && job.wrk_config) { setIncludeWRK(true); setWrkConfig(job.wrk_config); } else { setIncludeWRK(false); }
                          setSites([{ ...EMPTY_SITE(), date: (job.wo_config || {}).defaultDate || "", numTechs: (job.wo_config || {}).numTechs || "1", numDays: (job.wo_config || {}).numDays || "1" }]);
                          setStep(0);
                          setShowHistoryPanel(false);
                        }} style={{ flex: 1, padding: "7px", borderRadius: 7, border: `1px solid ${T.border2}`, background: "transparent", color: T.textMid, cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}>Config only</button>
                      </div>
                    </div>
                  ))
                }
              </div>
            {null}
            </div>
          </div>
        )}

        {/* Route WOs panel */}
        {showRoutePanel && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 400, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }} onClick={() => setShowRoutePanel(false)}>
            <div style={{ background: T.surface, borderLeft: `2px solid ${T.accent}`, height: "100%", width: "100%", maxWidth: 460, overflowY: "auto", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, background: T.surface, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3, color: T.accentHi }}>🎯 ROUTE WORK ORDERS</div>
                  <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>Enter a provider ID to pre-route a site · Leave blank to publish open</div>
                </div>
                <button onClick={() => setShowRoutePanel(false)} style={{ background: "transparent", border: "none", color: T.textMid, cursor: "pointer", fontSize: 20, flexShrink: 0 }}>✕</button>
              </div>

              {/* Global assign all techs to one provider */}
              <div style={{ padding: "1rem 1.5rem", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 8, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 }}>Assign ALL tech slots across all sites</label>
                  <input
                    id="route-global"
                    style={{ ...T.inp, width: "100%" }}
                    placeholder="Provider ID (e.g. 12345)"
                    onFocus={e => e.target.style.borderColor=T.accent}
                    onBlur={e => e.target.style.borderColor=T.border2}
                  />
                </div>
                <button onClick={() => {
                  const val = document.getElementById("route-global").value.trim();
                  setSites(prev => prev.map(s => {
                    if (!rowComplete(s)) return s;
                    const n = Number(s.numTechs || woConfig.numTechs) || 1;
                    return { ...s, routeToTechs: Array(n).fill(val) };
                  }));
                }} style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${T.accent},#dc6209)`, color: "#000", cursor: "pointer", fontFamily: "'Bebas Neue',sans-serif", fontSize: 13, letterSpacing: 1.5, whiteSpace: "nowrap" }}>APPLY ALL</button>
                <button onClick={() => setSites(prev => prev.map(s => ({ ...s, routeToTechs: [] })))} style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid ${T.border2}`, background: "transparent", color: T.textDim, cursor: "pointer", fontSize: 11, fontFamily: "inherit", whiteSpace: "nowrap" }}>Clear all</button>
              </div>

              {/* Per-site, per-tech list */}
              <div style={{ flex: 1, padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: 12 }}>
                {sites.filter(rowComplete).map((site, i) => {
                  const realIdx = sites.indexOf(site);
                  const numTechs = Number(site.numTechs || woConfig.numTechs) || 1;
                  const techSlots = Array.from({ length: numTechs }, (_, ti) => (site.routeToTechs || [])[ti] || "");
                  const anyRouted = techSlots.some(Boolean);
                  return (
                    <div key={i} style={{ background: T.surface2, border: `1px solid ${anyRouted ? T.accent : T.border}`, borderRadius: 10, padding: "0.85rem 1rem" }}>
                      {/* Site header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 14, letterSpacing: 1.5, color: anyRouted ? T.accentHi : T.textMid }}>
                            {site.code}{site.branchName ? ` — ${site.branchName}` : ""}
                          </div>
                          <div style={{ fontSize: 10, color: T.textFaint, marginTop: 1 }}>{site.city}, {site.state} · {numTechs} tech{numTechs > 1 ? "s" : ""} × {site.numDays || woConfig.numDays} day{Number(site.numDays || woConfig.numDays) > 1 ? "s" : ""}</div>
                        </div>
                        {anyRouted && (
                          <button onClick={() => setSites(prev => prev.map((s, idx) => idx === realIdx ? { ...s, routeToTechs: [] } : s))}
                            style={{ background: "transparent", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>clear</button>
                        )}
                      </div>
                      {/* One input per tech slot */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {techSlots.map((val, ti) => (
                          <div key={ti} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ fontSize: 10, color: T.textFaint, width: 52, flexShrink: 0 }}>Tech {ti + 1}</div>
                            <input
                              style={{ ...T.inp, flex: 1, fontSize: 12, ...(val ? { borderColor: T.accent } : {}) }}
                              placeholder="Provider ID (blank = open)"
                              value={val}
                              onChange={e => {
                                const updated = [...techSlots];
                                updated[ti] = e.target.value;
                                setSites(prev => prev.map((s, idx) => idx === realIdx ? { ...s, routeToTechs: updated } : s));
                              }}
                              onFocus={e => e.target.style.borderColor=T.accent}
                              onBlur={e => e.target.style.borderColor=val ? T.accent : T.border2}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div style={{ padding: "1rem 1.5rem", borderTop: `1px solid ${T.border}`, position: "sticky", bottom: 0, background: T.surface }}>
                <button onClick={() => setShowRoutePanel(false)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${T.accent},#dc6209)`, color: "#000", cursor: "pointer", fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: 2 }}>DONE</button>
              </div>

            </div>
          </div>
        )}

        {/* Easter egg toast */}
        {easterEgg && (
          <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg,#1e1b4b,#312e81)", border: "1px solid #7c3aed", borderRadius: 12, padding: "14px 24px", color: "#e0e7ff", fontSize: 14, fontFamily: "inherit", zIndex: 9999, maxWidth: 420, textAlign: "center", boxShadow: "0 8px 32px rgba(124,58,237,0.4)", animation: "none" }}
            onClick={() => setEasterEgg(null)}>
            {easterEgg}
          </div>
        )}

        {/* Admin lock/unlock modal */}
        {showLockModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 14, padding: "1.5rem", width: "100%", maxWidth: 360 }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3, color: T.accentHi, marginBottom: 6 }}>🔓 ADMIN UNLOCK</div>
              <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16, lineHeight: 1.6 }}>Enter the admin password to enable editing and deleting of work order types.</div>
              <input
                type="password"
                placeholder="Admin password"
                value={lockPwInput}
                autoFocus
                onChange={e => { setLockPwInput(e.target.value); setLockPwError(false); }}
                onKeyDown={e => { if (e.key === "Enter") {
                  const adminPw = import.meta.env.VITE_DELETE_PASSWORD || import.meta.env.VITE_APP_PASSWORD;
                  if (lockPwInput === adminPw) { setAdminUnlocked(true); setShowLockModal(false); }
                  else setLockPwError(true);
                }}}
                style={{ ...T.inp, width: "100%", marginBottom: 6, ...(lockPwError ? { borderColor: "#ef4444" } : {}) }}
              />
              {lockPwError && <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 10 }}>⚠ Incorrect password</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button onClick={() => setShowLockModal(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${T.border2}`, background: "transparent", color: T.textMid, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>Cancel</button>
                <button onClick={() => {
                  const adminPw = import.meta.env.VITE_DELETE_PASSWORD || import.meta.env.VITE_APP_PASSWORD;
                  if (lockPwInput === adminPw) { setAdminUnlocked(true); setShowLockModal(false); }
                  else setLockPwError(true);
                }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${T.accent},#dc6209)`, color: "#000", cursor: "pointer", fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: 2 }}>UNLOCK</button>
              </div>
            {null}
            </div>
          </div>
        )}

        {/* Delete confirm modal */}
        {deleteConfirm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: T.surface, border: "1px solid #ef4444", borderRadius: 14, padding: "1.5rem", width: "100%", maxWidth: 380 }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 3, color: "#ef4444", marginBottom: 10 }}>DELETE WO TYPE</div>
              <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16, lineHeight: 1.7 }}>
                You are about to delete <span style={{ color: T.text, fontWeight: 600 }}>{deleteConfirm.key}</span>.{deleteConfirm.isBuiltin ? " Built-in types can be recovered later." : " Custom types are permanently removed."}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${T.border2}`, background: "transparent", color: T.textMid, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>Cancel</button>
                <button onClick={() => {
                  const k = deleteConfirm.key;
                  if (deleteConfirm.isBuiltin) {
                    const next = { ...deletedBuiltins, [k]: true };
                    saveDeletedBuiltins(next);
                  } else {
                    const next = { ...customWoTypes };
                    delete next[k];
                    saveCustomWoTypes(next);
                  }
                  if (woType === k) setWoType(Object.keys(ALL_WO_TYPES).find(x => x !== k) || "LVL");
                  setDeleteConfirm(null);
                }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, letterSpacing: 2 }}>CONFIRM DELETE</button>
              </div>
            {null}
            </div>
          </div>
        )}

        {/* Recover deleted built-ins modal */}
        {showRecoverModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "1.5rem", width: "100%", maxWidth: 380 }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 3, color: T.accentHi, marginBottom: 14 }}>RECOVER WO TYPES</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {Object.keys(deletedBuiltins).map(k => (
                  <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: T.surface2, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    <div>
                      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 14, letterSpacing: 2, color: T.textMid }}>{k}</div>
                      <div style={{ fontSize: 11, color: T.textFaint }}>{WO_TYPES[k]?.label}</div>
                    </div>
                    <button onClick={() => {
                      const next = { ...deletedBuiltins };
                      delete next[k];
                      saveDeletedBuiltins(next);
                      if (Object.keys(next).length === 0) setShowRecoverModal(false);
                    }} style={{ background: "#22c55e", border: "none", borderRadius: 6, padding: "6px 14px", color: "#000", cursor: "pointer", fontFamily: "'Bebas Neue',sans-serif", fontSize: 13, letterSpacing: 1 }}>↩ RESTORE</button>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowRecoverModal(false)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid ${T.border2}`, background: "transparent", color: T.textMid, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>Close</button>
            </div>
          </div>
        )}

        {/* Custom WO Type modal */}
        {showCustomModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "1.5rem", width: "100%", maxWidth: 420 }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3, color: T.accentHi, marginBottom: 16 }}>{editingCustomKey ? "EDIT CUSTOM WO TYPE" : "NEW CUSTOM WO TYPE"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { key: "key",          label: "Type Code (e.g. SRV)", ph: "SRV",                  readOnly: !!editingCustomKey, span: false },
                  { key: "label",        label: "Description",          ph: "SRV — Service Visit",  readOnly: false,               span: true  },
                  { key: "siteIdSuffix", label: "Site ID Suffix",       ph: "SRV",                  readOnly: false,               span: false },
                  { key: "numTechs",     label: "Default # Techs",      ph: "1",                    readOnly: false,               span: false },
                  { key: "numDays",      label: "Default # Days",       ph: "1",                    readOnly: false,               span: false },
                ].map(({ key, label, ph, readOnly, span }) => (
                  <div key={key} style={span ? { gridColumn: "span 2" } : {}}>
                    <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{label}</label>
                    <input
                      style={{ ...T.inp, ...(readOnly ? { opacity: 0.5 } : {}) }}
                      placeholder={ph}
                      value={customForm[key] || ""}
                      readOnly={readOnly}
                      onChange={e => !readOnly && setCustomForm(prev => ({ ...prev, [key]: key === "key" ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) : e.target.value }))}
                      onFocus={e => !readOnly && (e.target.style.borderColor = T.accent)}
                      onBlur={e => (e.target.style.borderColor = T.border2)}
                    />
                  </div>
                ))}
                <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 0" }} onClick={() => setCustomForm(prev => ({ ...prev, useBundle: !prev.useBundle }))}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${customForm.useBundle ? T.accent : T.border2}`, background: customForm.useBundle ? T.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {customForm.useBundle && <span style={{ color: "#000", fontSize: 11, fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 12, color: T.textMid }}>Bundle work orders by Site ID</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={() => setShowCustomModal(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${T.border2}`, background: "transparent", color: T.textMid, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>Cancel</button>
                <button
                  disabled={!editingCustomKey && !customForm.key.trim()}
                  onClick={() => {
                    const k = editingCustomKey || customForm.key.trim();
                    if (!k) return;
                    const entry = {
                      label: customForm.label || k,
                      siteIdSuffix: customForm.siteIdSuffix || k,
                      numTechs: Number(customForm.numTechs) || 1,
                      numDays: Number(customForm.numDays) || 1,
                      useBundle: !!customForm.useBundle
                    };
                    if (WO_TYPES[k]) {
                      // Editing a built-in — store as override
                      const nextOv = { ...overriddenBuiltins, [k]: entry };
                      saveOverriddenBuiltins(nextOv);
                    } else {
                      const next = { ...customWoTypes, [k]: entry };
                      saveCustomWoTypes(next);
                    }
                    setWoType(k);
                    setWoConfig(WO_DEFAULTS[k] ? { ...WO_DEFAULTS[k] } : { templateId: "", startTime: "", defaultDate: "", techType: "Tech", numTechs: entry.numTechs.toString(), numDays: entry.numDays.toString(), budgetTech: "", payRate: "", approxHours: "", country: "" });
                    setShowCustomModal(false);
                  }}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: (customForm.key.trim() || editingCustomKey) ? `linear-gradient(135deg,${T.accent},#dc6209)` : T.disabledBg, color: (customForm.key.trim() || editingCustomKey) ? "#000" : T.disabledText, cursor: (customForm.key.trim() || editingCustomKey) ? "pointer" : "not-allowed", fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: 2 }}
                >
                  {editingCustomKey ? "SAVE CHANGES" : "CREATE TYPE"}
                </button>
              </div>
            {null}
            </div>
          </div>
        )}

        {/* Template ID label prompt modal */}
        {pendingTidLabel && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 14, padding: "1.75rem", width: "100%", maxWidth: 380, margin: "0 1rem" }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 2, color: T.accent, marginBottom: 6 }}>NEW TEMPLATE ID</div>
              <div style={{ fontSize: 12, color: T.textDim, marginBottom: 14, lineHeight: 1.6 }}>
                <span style={{ color: T.text, fontWeight: 600 }}>{pendingTidLabel.id}</span> hasn't been used before.<br />Add a label so you can recognize it later.
              </div>
              <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>Label (optional)</label>
              <input
                autoFocus
                style={{ ...T.inp, marginBottom: 14 }}
                placeholder="e.g. PNC Conversion Lead"
                value={tidLabelInput}
                onChange={e => setTidLabelInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && confirmTidLabel()}
                onFocus={e => e.target.style.borderColor=T.accent}
                onBlur={e => e.target.style.borderColor=T.border2}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => confirmTidLabel()} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${T.accent},#dc6209)`, color: "#000", fontFamily: "'Bebas Neue',sans-serif", fontSize: 14, letterSpacing: 2, cursor: "pointer" }}>
                  SAVE & CONTINUE
                </button>
                <button onClick={() => confirmTidLabel(true)} style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${T.border2}`, background: "transparent", color: T.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                  Skip
                </button>
              </div>
            {null}
            </div>
          </div>
        )}

        {/* Joke footer */}
        <div style={{ marginTop: 40, padding: "14px 18px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>😄</span>
          <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6, fontStyle: "italic" }}>{joke}</div>
          <button onClick={() => setJoke(JOKES[Math.floor(Math.random() * JOKES.length)])} style={{ marginLeft: "auto", flexShrink: 0, background: "transparent", border: `1px solid ${T.border2}`, borderRadius: 6, padding: "3px 10px", color: T.textFaint, cursor: "pointer", fontSize: 10, fontFamily: "inherit" }}>next</button>
        </div>

        {/* Logout */}
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={() => { sessionStorage.removeItem("cpwog_session"); setAuthed(false); setPwInput(""); setStep(0); setProjectId(""); setDisplayName(""); setWoType("LVL"); setWoConfig({ ...WO_DEFAULTS["LVL"] }); setSites([EMPTY_SITE()]); }} style={{ background: "transparent", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 11, fontFamily: "inherit", textDecoration: "underline" }}>
            Log out
          </button>
        </div>
      {null}
      </div>
    </div>
  );
}
