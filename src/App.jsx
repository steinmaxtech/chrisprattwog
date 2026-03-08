import { useState, useCallback, useRef, useEffect } from "react";

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

// WO type metadata — structure only, no hardcoded values
const WO_TYPES = {
  LVL:  { label: "LVL — Low Voltage Lead",          siteIdSuffix: "LVL(1)", numTechs: 1, numDays: 3, useBundle: true  },
  LVT:  { label: "LVT — Low Voltage Tech",           siteIdSuffix: "LVT",    numTechs: 3, numDays: 3, useBundle: true  },
  DEL:  { label: "DEL — Delivery/Install",           siteIdSuffix: "DEL",    numTechs: 1, numDays: 1, useBundle: false },
  BRK:  { label: "BRK — Backerboard Creation",          siteIdSuffix: "BRK",    numTechs: 1, numDays: 1, useBundle: false },
  INT:  { label: "INT — Installation Technician",        siteIdSuffix: "INT",    numTechs: 1, numDays: 1, useBundle: false },
  INL:  { label: "INL — Installation Lead",              siteIdSuffix: "INL",    numTechs: 1, numDays: 1, useBundle: false },
};

// Default configs per type — blank, user fills in each run
const BLANK_CFG = { templateId: "", startTime: "", techType: "", numTechs: "1", numDays: "1", budgetTech: "", payRate: "", approxHours: "", country: "" };
const WO_DEFAULTS = {
  LVL:  { ...BLANK_CFG, templateId: "103095" },
  LVT:  { ...BLANK_CFG, templateId: "103094" },
  DEL:  { ...BLANK_CFG, templateId: "102221" },
  BRK:  { ...BLANK_CFG, templateId: "102222" },
  INT:  { ...BLANK_CFG, templateId: "103096" },
  INL:  { ...BLANK_CFG, templateId: "103097" },
};

// Build rows using live woConfig values
function buildRows(site, projectId, displayName, woType, cfg) {
  const locPrefix = displayName.trim() || projectId;
  const meta = WO_TYPES[woType];
  const rows = [];
  const tId = Number(cfg.templateId);
  const budget = Number(cfg.budgetTech);
  const pay = Number(cfg.payRate);
  const hours = Number(cfg.approxHours);

  const numTechs = Number(cfg.numTechs) || 1;
  const numDays = Number(cfg.numDays) || 1;
  if (numTechs > 1) {
    for (let t = 1; t <= numTechs; t++) {
      for (let d = 0; d < numDays; d++) {
        const date = addDays(site.date, d);
        const siteId = `${site.code}-${meta.siteIdSuffix}(${t})`;
        const locName = `${locPrefix}-${siteId}-${site.city}, ${site.state}`;
        rows.push(makeRow({ templateId: tId, projectId, siteId, bundle: meta.useBundle ? siteId : "", site, date, startTime: cfg.startTime, techType: `${cfg.techType} ${t}`, budgetTech: budget, maxBudget: budget, payRate: pay, approxHours: hours, estDuration: hours, country: cfg.country, locName }));
      }
    }
  } else {
    for (let d = 0; d < numDays; d++) {
      const date = addDays(site.date, d);
      const siteId = `${site.code}-${meta.siteIdSuffix}`;
      const locName = `${locPrefix}-${siteId}-${site.city}, ${site.state}`;
      rows.push(makeRow({ templateId: tId, projectId, siteId, bundle: meta.useBundle ? siteId : "", site, date, startTime: cfg.startTime, techType: cfg.techType, budgetTech: budget, maxBudget: budget, payRate: pay, approxHours: hours, estDuration: hours, country: cfg.country, locName }));
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
  "Location Display Name","Location Name"
];

function makeRow({ templateId, projectId, siteId, bundle, site, date, startTime, techType, budgetTech, maxBudget, payRate, approxHours, estDuration, country, locName }) {
  return [
    templateId, projectId, siteId, bundle,
    site.address, site.address2 || "", site.city, site.state, site.zip,
    country, "", date, "", startTime, "",
    techType, "", "",
    budgetTech, "", maxBudget, payRate,
    "", "", "", "", approxHours, estDuration, "Fixed",
    locName, locName
  ];
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
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
];

const LOGO_IMG = "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";


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
  const inputRefs = useRef({});
  const [dark, setDark] = useState(() => { try { return sessionStorage.getItem("cpwog_dark") === "1"; } catch { return false; } });

  // Persist work state to session on every relevant change
  useEffect(() => {
    if (authed) saveSession({ step, projectId, displayName, woType, woConfig, sites });
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
  const [pendingTidLabel, setPendingTidLabel] = useState(null); // {type, id} waiting for label
  const [tidLabelInput, setTidLabelInput] = useState("");

  // Load saved template ID history from Supabase on mount
  useEffect(() => {
    sbFetch("/template_id_history?id=eq.1&select=data")
      .then(r => r.ok ? r.json() : null)
      .then(rows => { if (rows?.[0]?.data) setTemplateIdHistory(rows[0].data); })
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

  const getEntryLabel = (type, id) => {
    const entries = templateIdHistory[type] || [];
    const entry = entries.find(e => (typeof e === "string" ? e : e.id) === id);
    if (!entry) return "";
    return typeof entry === "string" ? "" : entry.label || "";
  };

  const handleContinueStep0 = () => {
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

  const updateSite = (i, field, val) =>
    setSites(prev => prev.map((s, idx) => {
      if (idx !== i) return s;
      const addrFields = ["address", "city", "state", "zip"];
      return { ...s, [field]: val, verified: addrFields.includes(field) ? null : s.verified, verifyError: "" };
    }));

  const addRows = (n) => setSites(prev => [...prev, ...Array(n).fill(null).map(EMPTY_SITE)]);
  const removeSite = (i) => setSites(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

  const parsePaste = () => {
    setPasteError("");
    if (!pasteText.trim()) { setPasteError("Nothing pasted yet."); return; }
    const lines = pasteText.trim().split("\n").map(l => l.split("\t"));
    const dataLines = lines[0][0]?.match(/^[A-Z]{2,}/i) && isNaN(lines[0][0]) && !lines[0][0].match(/^[A-Z]{1,4}\d/)
      ? lines.slice(1) : lines;
    if (dataLines.length === 0) { setPasteError("No data rows found."); return; }
    const parsed = dataLines.map(cols => ({
      code:       (cols[0] || "").trim(),
      branchName: (cols[1] || "").trim(),
      address:    (cols[4] || "").trim(),
      address2:   "",
      city:       (cols[5] || "").trim(),
      state:      (cols[6] || "").trim(),
      zip:        String(cols[7] || "").trim(),
      date: (() => {
        const raw = (cols[11] || "").trim();
        if (!raw) return "";
        const d = new Date(raw);
        if (!isNaN(d)) return d.toISOString().split("T")[0];
        return raw;
      })(),
      verified: null, verifying: false, verifyError: ""
    })).filter(s => s.code || s.address);
    if (parsed.length === 0) { setPasteError("Could not parse any rows."); return; }
    setSites(parsed);
    setPasteMode(false);
    setPasteText("");
  };

  const verifySite = async (i) => {
    const s = sites[i];
    if (!s.address) return;
    setSites(prev => prev.map((x, idx) => idx === i ? { ...x, verifying: true, verifyError: "" } : x));
    try {
      const fullAddr = [s.address, s.city, s.state, s.zip].filter(Boolean).join(", ");
      const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(fullAddr)}&benchmark=Public_AR_Current&format=json`;
      const res = await fetch(url);
      const data = await res.json();
      const matches = data?.result?.addressMatches;
      if (!matches || matches.length === 0) throw new Error("No match found");
      const m = matches[0];
      const c = m.addressComponents;
      const addr = `${c.fromAddress} ${c.streetName}${c.suffixType ? " " + c.suffixType : ""}`.trim().replace(/\s+/g, " ");
      setSites(prev => prev.map((x, idx) => idx === i
        ? { ...x, verifying: false, verified: true, address: addr || x.address, city: c.city || x.city, state: c.state || x.state, zip: c.zip || x.zip, verifyError: "" }
        : x));
    } catch (e) {
      setSites(prev => prev.map((x, idx) => idx === i ? { ...x, verifying: false, verified: false, verifyError: e.message } : x));
    }
  };

  const verifyAll = async () => {
    for (let i = 0; i < sites.length; i++) {
      if (sites[i].address && sites[i].verified !== true) await verifySite(i);
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
  const sitesComplete = sites.every(rowComplete);

  const canProceed = [
    projectId.trim().length > 0 && !!woType,
    sitesComplete,
    true
  ];

  const downloadCSV = useCallback(() => {
    setGenerating(true);
    try {
      const rows = [];
      for (const site of sites) {
        const siteRows = buildRows(site, projectId, displayName, woType, woConfig);
        // Remove trailing blank from last site
        rows.push(...siteRows);
      }
      if (rows.length && rows[rows.length-1].length === 0) rows.pop();
      const csv = toCSV(WO_HEADERS, rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeProject = projectId.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
      const date = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `FieldNation_${woType}_${safeProject}_${date}.csv`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error: " + err.message);
    }
    setGenerating(false);
  }, [sites, projectId, displayName, woType, woConfig]);


  const totalRows = sites.filter(rowComplete).reduce((sum, site) => sum + buildRows(site, projectId, displayName, woType, woConfig).filter(r => r.length > 0).length, 0);

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
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'DM Mono','Courier New',monospace", background: T.bg, minHeight: "100vh", color: T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, textarea { font-family: 'DM Mono', monospace; }
        input:focus, textarea:focus { outline: none; border-color: ${T.accent} !important; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${T.surface}; }
        ::-webkit-scrollbar-thumb { background: ${T.accent}; border-radius: 3px; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: ${dark ? "invert(0.6)" : "none"}; }
        .tab-btn { background: transparent; border: none; cursor: pointer; padding: 8px 16px; font-family: 'DM Mono',monospace; font-size: 12px; border-bottom: 2px solid transparent; transition: all .15s; }
        .tab-btn.active { color: ${T.tabActive}; border-bottom-color: ${T.tabActive}; }
        .tab-btn:not(.active) { color: ${T.tabInactive}; }
        .tab-btn:not(.active):hover { color: ${T.tabHover}; }
        .wo-card { border-radius: 10px; padding: 1rem 1.25rem; cursor: pointer; display: flex; align-items: center; gap: 14px; transition: all .15s; border: 2px solid ${T.border}; background: ${T.surface}; }
        .wo-card:hover { border-color: ${T.border2}; }
        .wo-card.selected { border-color: ${T.accent}; background: ${T.cardSel}; }
      `}</style>

      {/* Header */}
      <div style={{ background: T.header, borderBottom: `2px solid ${T.accent}`, padding: "0 2rem" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", gap: 14, padding: "1.1rem 0" }}>
          <img src={`data:image/png;base64,${LOGO_IMG}`} alt="Logo" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `2px solid ${T.accent}` }} />
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
          </div>
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

        {/* STEP 0: Project Info + WO Type */}
        {step === 0 && (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ background: T.surface, borderRadius: 12, padding: "1.5rem", border: `1px solid ${T.border}` }}>
              <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>Project ID</label>
              <input style={T.inp} placeholder="e.g. 10035574 - 4569395 - PNC - First Bank Conversion" value={projectId} onChange={e => setProjectId(e.target.value)} onFocus={e => e.target.style.borderColor=T.accent} onBlur={e => e.target.style.borderColor=T.border2} />
              <div style={{ fontSize: 11, color: T.textFaint, marginTop: 6 }}>Example: <span style={{ color: T.accentHi }}>10035574 - 4569395 - PNC - First Bank Conversion</span></div>
              <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6, marginTop: 14 }}>Location Display Name Prefix</label>
              <input style={T.inp} placeholder="e.g. PNC - FB Conversion (H1)" value={displayName} onChange={e => setDisplayName(e.target.value)} onFocus={e => e.target.style.borderColor=T.accent} onBlur={e => e.target.style.borderColor=T.border2} />
              <div style={{ fontSize: 11, color: T.textFaint, marginTop: 6 }}>Used as prefix in Location Display Name and Location Name columns · defaults to Project ID if blank</div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>Work Order Type — one CSV per run</div>
              <div style={{ display: "grid", gap: 8 }}>
                {Object.entries(WO_TYPES).map(([key, wot]) => (
                  <div key={key} className={`wo-card${woType === key ? " selected" : ""}`} onClick={() => { setWoType(key); setWoConfig({ ...WO_DEFAULTS[key] }); }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${woType === key ? T.accent : T.textFaint}`, background: woType === key ? T.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {woType === key && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#000" }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, letterSpacing: 2, color: woType === key ? T.accentHi : T.textMid }}>{key}</div>
                      <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>{wot.label} · {wot.desc}</div>
                    </div>
                    <div style={{ fontSize: 11, color: T.textFaint, textAlign: "right", lineHeight: 1.7 }}>
                      <div>Template <span style={{ color: T.textMid }}>{wot.templateId}</span></div>
                      <div>Budget <span style={{ color: T.textMid }}>${wot.maxBudget}</span> · Pay <span style={{ color: T.textMid }}>${wot.payRate}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Config form for selected WO type */}
            {woType && (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "1.5rem" }}>
                <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 14 }}>
                  Configure <span style={{ color: T.accentHi }}>{woType}</span> Work Order
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {/* Template ID with history dropdown */}
                  <div style={{ position: "relative" }}>
                    <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 }}>Template ID</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        style={{ ...T.inp, flex: 1 }}
                        placeholder="e.g. 103095"
                        value={woConfig.templateId}
                        onChange={e => setWoConfig(prev => ({ ...prev, templateId: e.target.value }))}
                        onFocus={e => { e.target.style.borderColor=T.accent; }}
                        onBlur={e => { e.target.style.borderColor=T.border2; setTimeout(() => setShowTidDropdown(false), 150); }}
                      />
                      {(templateIdHistory[woType]?.length > 0) && (
                        <button
                          onClick={() => setShowTidDropdown(d => !d)}
                          style={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 7, padding: "0 10px", color: T.textMid, cursor: "pointer", fontSize: 13, flexShrink: 0 }}
                          title="Recent template IDs"
                        >▾</button>
                      )}
                    </div>
                    {showTidDropdown && templateIdHistory[woType]?.length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 7, zIndex: 100, marginTop: 3, overflow: "hidden" }}>
                        {templateIdHistory[woType].map((entry, i) => {
                          const tid = typeof entry === "string" ? entry : entry.id;
                          const lbl = typeof entry === "string" ? "" : entry.label;
                          return (
                            <div key={tid} onClick={() => { setWoConfig(prev => ({ ...prev, templateId: tid })); setShowTidDropdown(false); }}
                              style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                              onMouseEnter={e => e.currentTarget.style.background=T.rowHover}
                              onMouseLeave={e => e.currentTarget.style.background="transparent"}
                            >
                              <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{tid}</span>
                              {lbl && <span style={{ fontSize: 11, color: T.textDim, marginLeft: 8 }}>{lbl}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: T.textFaint, marginTop: 3 }}>FieldNation template number · saved on continue</div>
                  </div>

                  {/* Remaining config fields */}
                  {[
                    { key: "startTime",   label: "Scheduled Start Time", ph: "4:30pm", hint: "e.g. 4:30pm or 13:00:00" },
                    { key: "techType",    label: "Tech Type",          ph: "Tech 1", hint: Number(woConfig.numTechs) > 1 ? `Base label — auto-numbered 1–${woConfig.numTechs}` : "Exact value in CSV" },
                    { key: "numTechs",    label: "Tech Count",         ph: "1",      hint: "Number of techs per site" },
                    { key: "numDays",     label: "Days Needed",        ph: "3",      hint: "Days per site per tech" },
                    { key: "budgetTech",  label: "Budget (Tech) $",   ph: "700",    hint: "Max budget per WO" },
                    { key: "payRate",     label: "Pay Rate $",         ph: "700",    hint: "Tech pay rate" },
                    { key: "approxHours",label: "Est. Hours",          ph: "10",     hint: "Approx hours to complete" },
                    { key: "country",     label: "Country",            ph: "US",     hint: "Leave blank if not required" },
                  ].map(({ key, label, ph, hint }) => (
                    <div key={key}>
                      <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 }}>{label}</label>
                      <input
                        style={T.inp}
                        placeholder={ph}
                        value={woConfig[key]}
                        onChange={e => setWoConfig(prev => ({ ...prev, [key]: e.target.value }))}
                        onFocus={e => e.target.style.borderColor=T.accent}
                        onBlur={e => e.target.style.borderColor=T.border2}
                      />
                      <div style={{ fontSize: 10, color: T.textFaint, marginTop: 3 }}>{hint}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, padding: "8px 12px", background: T.surface2, borderRadius: 7, fontSize: 11, color: T.textFaint, lineHeight: 1.7 }}>
                  Pattern: <span style={{ color: T.textMid }}>{woConfig.numTechs} tech{Number(woConfig.numTechs) > 1 ? "s" : ""} × {woConfig.numDays} day{Number(woConfig.numDays) > 1 ? "s" : ""}</span>
                  &nbsp;·&nbsp; Site ID suffix: <span style={{ color: T.accentHi }}>{WO_TYPES[woType].siteIdSuffix}</span>
                  &nbsp;·&nbsp; Bundle: <span style={{ color: T.textMid }}>{WO_TYPES[woType].useBundle ? "yes" : "no"}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 1: Add Sites */}
        {step === 1 && (
          <div>
            <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, marginBottom: 16 }}>
              <button className={`tab-btn${pasteMode ? " active" : ""}`} onClick={() => setPasteMode(true)}>⌘ Paste from Spreadsheet</button>
              <button className={`tab-btn${!pasteMode ? " active" : ""}`} onClick={() => setPasteMode(false)}>✎ Edit Table ({sites.length} rows)</button>
            </div>

            {pasteMode ? (
              <div>
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
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={parsePaste} style={{ background: `linear-gradient(135deg,${T.accent},#dc6209)`, border: "none", borderRadius: 6, padding: "8px 20px", color: "#000", cursor: "pointer", fontSize: 12, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1.5 }}>
                    PARSE {pasteText.trim().split("\n").filter(Boolean).length} ROWS →
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
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => addRows(1)} style={{ background: T.disabledBg, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "6px 14px", color: T.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>+ Row</button>
                    <button onClick={() => addRows(5)} style={{ background: T.disabledBg, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "6px 14px", color: T.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>+ 5 Rows</button>
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
                        const borderColor = site.verified === true ? "#22c55e" : site.verified === false ? "#ef4444" : complete ? "#f59e0b" : "transparent";
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
                                    placeholder={col.ph}
                                    onChange={e => updateSite(rowIdx, col.key, e.target.value)}
                                    onKeyDown={e => handleKeyDown(e, rowIdx, colIdx)}
                                    onFocus={() => setActiveCell({ row: rowIdx, col: colIdx })}
                                    style={{ width: "100%", background: "transparent", border: "none", padding: "6px 8px", color: T.text, fontSize: 12, fontFamily: "inherit", outline: cellActive ? "2px solid #e97316" : "none", outlineOffset: "-1px", borderRadius: 3 }}
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
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{WO_TYPES[woType].label}</div>
              </div>
            </div>

            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1.1rem", marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: T.textFaint, textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>CSV Summary</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ color: T.textDim }}>Sites</span>
                <span style={{ color: T.textMid }}>{sites.filter(rowComplete).length}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ color: T.textDim }}>Pattern</span>
                <span style={{ color: T.textMid }}>{woConfig.numTechs} tech{Number(woConfig.numTechs) > 1 ? "s" : ""} × {woConfig.numDays} day{Number(woConfig.numDays) > 1 ? "s" : ""}</span>
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
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingTop: 8 }}>
                <span style={{ color: T.textDim }}>Total data rows</span>
                <span style={{ color: T.text, fontWeight: 600 }}>{totalRows}</span>
              </div>
            </div>

            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1.1rem", marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: T.textFaint, textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>Sites ({sites.filter(rowComplete).length})</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 8 }}>
                {sites.filter(rowComplete).map((s, i) => (
                  <div key={i} style={{ background: T.surface2, borderRadius: 6, padding: "8px 10px", borderLeft: `3px solid ${s.verified === true ? "#22c55e" : "T.border2"}` }}>
                    <div style={{ fontSize: 12, color: T.accent, fontWeight: 600 }}>{s.code}{s.branchName ? ` — ${s.branchName}` : ""}</div>
                    <div style={{ fontSize: 11, color: T.textDim, marginTop: 2, lineHeight: 1.5 }}>{s.address}{s.address2 ? `, ${s.address2}` : ""}<br />{s.city}, {s.state} {s.zip}</div>
                    <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>Start: {s.date}</div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={downloadCSV} disabled={generating} style={{ width: "100%", padding: "1rem", borderRadius: 10, border: "none", cursor: generating ? "not-allowed" : "pointer", background: generating ? T.disabledBg : `linear-gradient(135deg,${T.accent},#dc6209)`, color: generating ? T.disabledText : "#000", fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3, transition: "all .2s", boxShadow: generating ? "none" : "0 4px 24px rgba(234,88,12,.35)" }}>
              {generating ? "⏳  BUILDING CSV..." : `⬇  DOWNLOAD ${woType} CSV`}
            </button>
            <div style={{ fontSize: 11, color: T.textFaint, textAlign: "center", marginTop: 8 }}>
              Single CSV file · Ready to upload directly to FieldNation
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
      </div>
    </div>
  );
}
