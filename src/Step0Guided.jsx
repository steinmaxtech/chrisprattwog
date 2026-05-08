import React from "react";

export default function Step0Guided({ T, woType, setWoType, setWoConfig, WO_DEFAULTS, ALL_WO_TYPES, woConfig, projectId, setProjectId, displayName, setDisplayName, projectIdHistory, showPidDropdown, setShowPidDropdown, woTemplates, applyTemplate, includeDEL, setIncludeDEL, includeBRK, setIncludeBRK, includeWRK, setIncludeWRK, setGuidedMode, guidedMode, isPastDate }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => { const next = !guidedMode; setGuidedMode(next); try { localStorage.setItem("cpwog_guided", next ? "1" : "0"); } catch {} }} style={{ fontSize: 11, color: T.textFaint, background: "transparent", border: `1px solid ${T.border2}`, borderRadius: 20, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}>
                ⚙ Switch to Advanced Mode
              </button>
            </div>
                {/* Template picker — shown first if templates exist */}
                {woTemplates.length > 0 && (
                  <div style={{ background: T.surface, borderRadius: 12, padding: "1.5rem", border: `1px solid ${T.border}` }}>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: 2, color: T.accentHi, marginBottom: 4 }}>📋 Start from a saved template?</div>
                    <div style={{ fontSize: 12, color: T.textDim, marginBottom: 12 }}>Pick a template to pre-fill all settings, or skip and configure below.</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {woTemplates.map(tpl => (
                        <button key={tpl.id} onClick={() => applyTemplate(tpl)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.border2}`, background: T.surface2, color: T.textMid, cursor: "pointer", fontSize: 12, fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                          <span style={{ fontWeight: 600, color: T.text }}>{tpl.name}</span>
                          <span style={{ fontSize: 10, color: T.textFaint }}>{tpl.woType}{tpl.includeDEL ? " + DEL" : ""}{tpl.includeBRK ? " + BRK" : ""}{tpl.includeWRK ? " + WRK" : ""}</span>
                        </button>
                      ))}
                    </div>{/* - */}
                  </div>
                )}

                {/* Project Name — single merged field */}
                <div style={{ background: T.surface, borderRadius: 12, padding: "1.5rem", border: `1px solid ${T.border}` }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: 2, color: T.accentHi, marginBottom: 4 }}>What project is this for?</div>
                  <div style={{ fontSize: 12, color: T.textDim, marginBottom: 12 }}>Enter the project name or ID — this appears on every work order.</div>
                  <div style={{ position: "relative" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input style={{ ...T.inp, flex: 1, fontSize: 14 }} placeholder="e.g. PNC - First Bank Conversion" value={projectId} onChange={e => { setProjectId(e.target.value); setDisplayName(e.target.value); }} onFocus={e => { e.target.style.borderColor=T.accent; }} onBlur={e => { e.target.style.borderColor=T.border2; setTimeout(() => setShowPidDropdown(false), 150); }} autoFocus />
                      {projectIdHistory.length > 0 && <button onClick={() => setShowPidDropdown(d => !d)} style={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 7, padding: "0 10px", color: T.textMid, cursor: "pointer", fontSize: 13 }}>▾</button>}
                    </div>
                    {showPidDropdown && projectIdHistory.length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 7, zIndex: 100, marginTop: 3, maxHeight: 200, overflowY: "auto" }}>
                        {projectIdHistory.map(pid => (
                          <div key={pid} onClick={() => { setProjectId(pid); setDisplayName(pid); setShowPidDropdown(false); }} style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13, color: T.textMid, borderBottom: `1px solid ${T.border}` }} onMouseEnter={e => e.currentTarget.style.background=T.rowHover} onMouseLeave={e => e.currentTarget.style.background="transparent"}>{pid}</div>
                        ))}
                      </div>
                    )}
                  </div>{/* - */}
                </div>

                {/* WO Type — plain English cards */}
                <div style={{ background: T.surface, borderRadius: 12, padding: "1.5rem", border: `1px solid ${T.border}` }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: 2, color: T.accentHi, marginBottom: 4 }}>What type of work are you scheduling?</div>
                  <div style={{ fontSize: 12, color: T.textDim, marginBottom: 14 }}>Pick one — you can generate different types separately.</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {Object.entries(ALL_WO_TYPES).map(([key, wot]) => {
                      const friendlyDesc = {
                        LVL: "Main installation lead — manages the site over multiple days",
                        LVT: "Low voltage technicians — multiple techs per site over multiple days",
                        DEL: "Equipment delivery and installation — one tech, one day",
                        BRK: "Backerboard creation — one tech, one day",
                        INT: "Installation technician — one tech, flexible days",
                        INL: "Installation lead — one tech, flexible days",
                        WRK: "Walk-in ready kit — one tech, one day",
                        SDT: "Security device technician — bundled BH/AH schedule over three days",
                      }[key] || wot.label || key;
                      return (
                        <div key={key} onClick={() => { setWoType(key); setWoConfig(WO_DEFAULTS[key] ? { ...WO_DEFAULTS[key] } : { templateId: "", startTime: "", defaultDate: "", techType: "Tech", numTechs: wot.numTechs?.toString() || "1", numDays: wot.numDays?.toString() || "1", budgetTech: "", payRate: "", approxHours: "", country: "" }); }}
                          style={{ padding: "14px 16px", borderRadius: 10, border: `2px solid ${woType === key ? T.accent : T.border}`, background: woType === key ? `${T.accent}12` : T.surface2, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all .15s" }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${woType === key ? T.accent : T.textFaint}`, background: woType === key ? T.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {woType === key && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#000" }} />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: woType === key ? T.accentHi : T.text }}>{key} — {(wot.label || key).replace(/^[A-Z]+ — /, "")}</div>
                            <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>{friendlyDesc}</div>
                          </div>
                          {woType === key && <div style={{ fontSize: 18 }}>✓</div>}
                        </div>
                      );
                    })}
                  </div>{/* - */}
                </div>{/* - */}
              </div>
  );
}

