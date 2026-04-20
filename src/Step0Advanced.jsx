import React from "react";

export default function Step0Advanced({ T, woType, setWoType, setWoConfig, WO_DEFAULTS, ALL_WO_TYPES, WO_TYPES, woConfig, projectId, setProjectId, displayName, setDisplayName, projectIdHistory, showPidDropdown, setShowPidDropdown, displayNameHistory, showDnDropdown, setShowDnDropdown, woTemplates, setShowTemplatePanel, adminUnlocked, templateIdHistory, showTidDropdown, setShowTidDropdown, FN_TEMPLATE_BANK, saveTemplateId, includeDEL, setIncludeDEL, delConfig, setDelConfig, showDelTidDropdown, setShowDelTidDropdown, delTidLabelInput, setDelTidLabelInput, includeBRK, setIncludeBRK, brkConfig, setBrkConfig, showBrkTidDropdown, setShowBrkTidDropdown, brkTidLabelInput, setBrkTidLabelInput, includeWRK, setIncludeWRK, wrkConfig, setWrkConfig, showWrkTidDropdown, setShowWrkTidDropdown, wrkTidLabelInput, setWrkTidLabelInput, setGuidedMode, guidedMode, deletedBuiltins, setDeleteConfirm, setDeletePw, setDeletePwError, setEditingCustomKey, setCustomForm, setShowCustomModal, setShowRecoverModal, isPastDate, overriddenBuiltins }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => { const next = !guidedMode; setGuidedMode(next); try { localStorage.setItem("cpwog_guided", next ? "1" : "0"); } catch {} }} style={{ fontSize: 11, color: T.textFaint, background: "transparent", border: `1px solid ${T.border2}`, borderRadius: 20, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}>
                ✦ Switch to Guided Mode
              </button>
            </div>
                <div style={{ background: T.surface, borderRadius: 12, padding: "1.5rem", border: `1px solid ${T.border}` }}>
                  <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>Project ID</label>
                  <div style={{ position: "relative" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input style={{ ...T.inp, flex: 1 }} placeholder="e.g. 10035574 - 4569395 - PNC - First Bank Conversion" value={projectId} onChange={e => { setProjectId(e.target.value); if (!displayName || displayName === projectId) setDisplayName(e.target.value); }} onFocus={e => { e.target.style.borderColor=T.accent; }} onBlur={e => { e.target.style.borderColor=T.border2; setTimeout(() => setShowPidDropdown(false), 150); }} />
                      {projectIdHistory.length > 0 && <button onClick={() => setShowPidDropdown(d => !d)} style={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 7, padding: "0 10px", color: T.textMid, cursor: "pointer", fontSize: 13, flexShrink: 0 }} title="Recent project IDs">▾</button>}
                    </div>
                    {showPidDropdown && projectIdHistory.length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 7, zIndex: 100, marginTop: 3, maxHeight: 200, overflowY: "auto" }}>
                        {projectIdHistory.map(pid => (
                          <div key={pid} onClick={() => { setProjectId(pid); if (!displayName || displayName === projectId) setDisplayName(pid); setShowPidDropdown(false); }} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 12, color: T.textMid, borderBottom: `1px solid ${T.border}` }} onMouseEnter={e => e.currentTarget.style.background=T.rowHover} onMouseLeave={e => e.currentTarget.style.background="transparent"}>{pid}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: T.textFaint, marginTop: 6 }}>Example: <span style={{ color: T.accentHi }}>10035574 - 4569395 - PNC - First Bank Conversion</span></div>
                  <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6, marginTop: 14 }}>Location Display Name Prefix</label>
                  <div style={{ position: "relative" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input style={{ ...T.inp, flex: 1 }} placeholder="e.g. PNC - FB Conversion (H1)" value={displayName} onChange={e => setDisplayName(e.target.value)} onFocus={e => { e.target.style.borderColor=T.accent; }} onBlur={e => { e.target.style.borderColor=T.border2; setTimeout(() => setShowDnDropdown(false), 150); }} />
                      {displayNameHistory.length > 0 && <button onClick={() => setShowDnDropdown(d => !d)} style={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 7, padding: "0 10px", color: T.textMid, cursor: "pointer", fontSize: 13, flexShrink: 0 }} title="Recent prefixes">▾</button>}
                    </div>
                    {showDnDropdown && displayNameHistory.length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 7, zIndex: 100, marginTop: 3, maxHeight: 200, overflowY: "auto" }}>
                        {displayNameHistory.map(dn => (
                          <div key={dn} onClick={() => { setDisplayName(dn); setShowDnDropdown(false); }} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 12, color: T.textMid, borderBottom: `1px solid ${T.border}` }} onMouseEnter={e => e.currentTarget.style.background=T.rowHover} onMouseLeave={e => e.currentTarget.style.background="transparent"}>{dn}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: T.textFaint, marginTop: 6 }}>Used as prefix in Location Display Name and Location Name columns · defaults to Project ID if blank</div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2 }}>Work Order Type — one CSV per run</div>
                    {woTemplates.length > 0 && <button onClick={() => setShowTemplatePanel(true)} style={{ fontSize: 11, color: T.accent, background: "transparent", border: `1px solid ${T.accent}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>📋 Use Template</button>}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select value={woType} onChange={e => { const k = e.target.value; const wot = ALL_WO_TYPES[k] || {}; setWoType(k); setWoConfig(WO_DEFAULTS[k] ? { ...WO_DEFAULTS[k] } : { templateId: "", startTime: "", defaultDate: "", techType: "Tech", numTechs: wot.numTechs?.toString() || "1", numDays: wot.numDays?.toString() || "1", budgetTech: "", payRate: "", approxHours: "", country: "US", payType: "Fixed" }); }}
                      style={{ flex: 1, ...T.inp, fontSize: 14, height: 42, fontFamily: "inherit" }}>
                      {Object.entries(ALL_WO_TYPES).map(([key, wot]) => (
                        <option key={key} value={key}>{key} — {(wot.label || key).replace(/^[A-Z]+ — /, "")}</option>
                      ))}
                    </select>
                    {adminUnlocked && woType && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => { setEditingCustomKey(woType); const wot = ALL_WO_TYPES[woType] || {}; setCustomForm({ key: woType, label: wot.label || "", siteIdSuffix: wot.siteIdSuffix || woType, numTechs: wot.numTechs?.toString() || "1", numDays: wot.numDays?.toString() || "1", useBundle: !!wot.useBundle }); setShowCustomModal(true); }} style={{ background: "transparent", border: `1px solid ${T.border2}`, borderRadius: 7, padding: "0 12px", color: T.textDim, cursor: "pointer", fontSize: 11, height: 42 }}>edit</button>
                        <button onClick={() => { setDeletePw(""); setDeletePwError(false); setDeleteConfirm({ key: woType, isBuiltin: !!WO_TYPES[woType] }); }} style={{ background: "transparent", border: "1px solid #ef4444", borderRadius: 7, padding: "0 12px", color: "#ef4444", cursor: "pointer", fontSize: 11, height: 42 }}>delete</button>
                      </div>
                    )}
                  </div>
                  {adminUnlocked && (
                    <button onClick={() => { setEditingCustomKey(null); setCustomForm({ key: "", label: "", siteIdSuffix: "", numTechs: "1", numDays: "1", useBundle: false }); setShowCustomModal(true); }}
                      style={{ marginTop: 8, width: "100%", background: "transparent", border: `1px dashed ${T.border2}`, borderRadius: 10, padding: "10px", color: T.textDim, cursor: "pointer", fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                      onMouseEnter={e => e.currentTarget.style.borderColor=T.accent}
                      onMouseLeave={e => e.currentTarget.style.borderColor=T.border2}>
                      <span style={{ fontSize: 16 }}>＋</span> Add Custom WO Type
                    </button>
                  )}
                  {adminUnlocked && Object.keys(deletedBuiltins).length > 0 && (
                    <button onClick={() => setShowRecoverModal(true)} style={{ marginTop: 6, width: "100%", background: "transparent", border: `1px dashed #22c55e`, borderRadius: 10, padding: "8px", color: "#22c55e", cursor: "pointer", fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>↩ Recover Deleted WO Types ({Object.keys(deletedBuiltins).length})</button>
                  )}
                </div>

            {/* Config form for selected WO type */}
            {woType && (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "1.5rem" }}>
                <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 14 }}>
                  Configure <span style={{ color: T.accentHi }}>{woType}</span> Work Order
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {/* Template ID with FN bank + history dropdown */}
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
                      <button onClick={() => setShowTidDropdown(d => !d)} style={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 7, padding: "0 10px", color: T.textMid, cursor: "pointer", fontSize: 13, flexShrink: 0 }} title="Choose template">▾</button>
                    </div>
                    {showTidDropdown && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 7, zIndex: 100, marginTop: 3, overflow: "hidden", maxHeight: 280, overflowY: "auto" }}>
                        {/* FN Template Bank */}
                        <div style={{ padding: "6px 12px", fontSize: 10, color: T.textFaint, textTransform: "uppercase", letterSpacing: 1.5, borderBottom: `1px solid ${T.border}`, background: T.surface2 }}>FieldNation Templates</div>
                        {FN_TEMPLATE_BANK.map(t => (
                          <div key={t.id} onClick={() => { setWoConfig(prev => ({ ...prev, templateId: t.id })); setShowTidDropdown(false); }}
                            style={{ padding: "9px 12px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                            onMouseEnter={e => e.currentTarget.style.background=T.rowHover}
                            onMouseLeave={e => e.currentTarget.style.background="transparent"}
                          >
                            <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{t.id}</span>
                            <span style={{ fontSize: 11, color: T.textDim }}>{t.name}</span>
                          </div>
                        ))}
                        {/* History — previously used IDs */}
                        {templateIdHistory[woType]?.length > 0 && <>
                          <div style={{ padding: "6px 12px", fontSize: 10, color: T.textFaint, textTransform: "uppercase", letterSpacing: 1.5, borderBottom: `1px solid ${T.border}`, background: T.surface2 }}>Recently Used</div>
                          {templateIdHistory[woType].map((entry) => {
                            const tid = typeof entry === "string" ? entry : entry.id;
                            const lbl = typeof entry === "string" ? "" : entry.label;
                            // Skip if already in bank
                            if (FN_TEMPLATE_BANK.find(t => t.id === tid)) return null;
                            return (
                              <div key={tid} onClick={() => { setWoConfig(prev => ({ ...prev, templateId: tid })); setShowTidDropdown(false); }}
                                style={{ padding: "9px 12px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                                onMouseEnter={e => e.currentTarget.style.background=T.rowHover}
                                onMouseLeave={e => e.currentTarget.style.background="transparent"}
                              >
                                <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{tid}</span>
                                {lbl && <span style={{ fontSize: 11, color: T.textDim, marginLeft: 8 }}>{lbl}</span>}
                              </div>
                            );
                          })}
                        </>}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: T.textFaint, marginTop: 3 }}>FieldNation template number · saved on continue</div>
                  </div>

                  {/* Remaining config fields */}
                  {[
                    { key: "startTime",   label: "Scheduled Start Time", ph: "4:30pm", hint: "e.g. 4:30pm or 13:00:00" },
                    { key: "defaultDate",  label: "Default Start Date",   ph: "", hint: isPastDate(woConfig.defaultDate) ? "⚠ This date is in the past" : "Pre-fills date column for all sites", type: "date" },
                    { key: "techType",    label: "Tech Type",          ph: "Tech 1", hint: Number(woConfig.numTechs) > 1 ? `Base label — auto-numbered 1–${woConfig.numTechs}` : "Exact value in CSV" },
                    { key: "numTechs",    label: "Tech Count",         ph: "1",      hint: "Number of techs per site" },
                    { key: "numDays",     label: "Days Needed",        ph: "3",      hint: "Days per site per tech" },
                    { key: "budgetTech",  label: "Budget (Tech) $",   ph: "700",    hint: "Max budget per WO" },
                    { key: "payRate",     label: "Pay Rate $",         ph: "700",    hint: "Tech pay rate" },
                    { key: "approxHours",label: "Est. Hours",          ph: "10",     hint: "Approx hours to complete" },
                    { key: "country",     label: "Country",            ph: "US",     hint: "Leave blank if not required" },
                  ].map(({ key, label, ph, hint, type }) => (
                    <div key={key}>
                      <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 }}>{label}</label>
                      <input
                        style={T.inp}
                        type={type || "text"}
                        placeholder={ph}
                        value={woConfig[key] || ""}
                        onChange={e => setWoConfig(prev => ({ ...prev, [key]: e.target.value }))}
                        onFocus={e => e.target.style.borderColor=T.accent}
                        onBlur={e => e.target.style.borderColor=T.border2}
                      />
                      <div style={{ fontSize: 10, color: T.textFaint, marginTop: 3 }}>{hint}</div>
                    </div>
                  ))}
                  {/* Pay Type toggle */}
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Pay Type</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {["Fixed", "Hourly"].map(pt => (
                        <button key={pt} onClick={() => setWoConfig(prev => ({ ...prev, payType: pt }))}
                          style={{ flex: 1, padding: "8px", borderRadius: 8, border: `2px solid ${(woConfig.payType || "Fixed") === pt ? T.accent : T.border2}`, background: (woConfig.payType || "Fixed") === pt ? `${T.accent}22` : "transparent", color: (woConfig.payType || "Fixed") === pt ? T.accentHi : T.textMid, cursor: "pointer", fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, letterSpacing: 2, transition: "all .15s" }}>
                          {pt}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4 }}>Sets the Pay Type column in the exported CSV</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, padding: "8px 12px", background: T.surface2, borderRadius: 7, fontSize: 11, color: T.textFaint, lineHeight: 1.7 }}>
                  Pattern: <span style={{ color: T.textMid }}>{woConfig.numTechs} tech{Number(woConfig.numTechs) > 1 ? "s" : ""} × {woConfig.numDays} day{Number(woConfig.numDays) > 1 ? "s" : ""}</span>
                  &nbsp;·&nbsp; Site ID suffix: <span style={{ color: T.accentHi }}>{ALL_WO_TYPES[woType]?.siteIdSuffix}</span>
                  &nbsp;·&nbsp; Bundle: <span style={{ color: T.textMid }}>{ALL_WO_TYPES[woType]?.useBundle ? "yes" : "no"}</span>
                  &nbsp;·&nbsp; Pay Type: <span style={{ color: T.textMid }}>{woConfig.payType || "Fixed"}</span>
                </div>
                <div style={{display:"contents"}}>
                    {/* BRK checkbox + config */}
                    <div style={{ marginTop: 10, padding: "10px 14px", background: T.surface2, borderRadius: 7, border: `1px solid ${includeBRK ? T.accent : T.border}`, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setIncludeBRK(d => !d)}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${includeBRK ? T.accent : T.border2}`, background: includeBRK ? T.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {includeBRK && <span style={{ color: "#000", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: includeBRK ? T.text : T.textMid, fontWeight: 600 }}>Also generate BRK (Backboard) work order on Day 1</div>
                        <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>Creates 1 BRK WO per site on Day 1 · configure below when enabled</div>
                      </div>
                    </div>
                    {includeBRK && (
                      <div style={{ marginTop: 10, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1rem" }}>
                        <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>BRK Work Order Config</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div style={{ position: "relative" }}>
                            <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Template ID</label>
                            <div style={{ display: "flex", gap: 6 }}>
                              <input style={{ ...T.inp, flex: 1 }} placeholder="102222" value={brkConfig.templateId || ""} onChange={e => setBrkConfig(prev => ({ ...prev, templateId: e.target.value }))} onFocus={e => { e.target.style.borderColor=T.accent; }} onBlur={e => { e.target.style.borderColor=T.border2; setTimeout(() => setShowBrkTidDropdown(false), 150); }} />
                              {(templateIdHistory["BRK"]?.length > 0) && (
                                <button onClick={() => setShowBrkTidDropdown(d => !d)} style={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 7, padding: "0 10px", color: T.textMid, cursor: "pointer", fontSize: 13, flexShrink: 0 }} title="Recent BRK template IDs">▾</button>
                              )}
                            </div>
                            {showBrkTidDropdown && templateIdHistory["BRK"]?.length > 0 && (
                              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 7, zIndex: 100, marginTop: 3, overflow: "hidden" }}>
                                {templateIdHistory["BRK"].map((entry) => {
                                  const tid = typeof entry === "string" ? entry : entry.id;
                                  const lbl = typeof entry === "string" ? "" : entry.label;
                                  return (
                                    <div key={tid} onClick={() => { setBrkConfig(prev => ({ ...prev, templateId: tid })); setShowBrkTidDropdown(false); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }} onMouseEnter={e => e.currentTarget.style.background=T.rowHover} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                                      <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{tid}</span>
                                      {lbl && <span style={{ fontSize: 11, color: T.textDim, marginLeft: 8 }}>{lbl}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <input style={{ ...T.inp, marginTop: 4, fontSize: 10 }} placeholder="Label (e.g. PNC BRK)" value={brkTidLabelInput} onChange={e => setBrkTidLabelInput(e.target.value)} onFocus={e => e.target.style.borderColor=T.accent} onBlur={e => e.target.style.borderColor=T.border2} />
                          </div>
                          {[{ key: "startTime", label: "Scheduled Start Time", ph: "13:00:00" }, { key: "techType", label: "Tech Type", ph: "Tech 1" }, { key: "budgetTech", label: "Budget (Tech) $", ph: "200" }, { key: "payRate", label: "Pay Rate $", ph: "150" }, { key: "approxHours", label: "Est. Hours", ph: "3" }, { key: "country", label: "Country", ph: "" }].map(({ key, label, ph }) => (
                            <div key={key}>
                              <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{label}</label>
                              <input style={T.inp} placeholder={ph} value={brkConfig[key] || ""} onChange={e => setBrkConfig(prev => ({ ...prev, [key]: e.target.value }))} onFocus={e => e.target.style.borderColor=T.accent} onBlur={e => e.target.style.borderColor=T.border2} />
                            </div>
                          ))}
                          <div style={{ gridColumn: "span 2" }}>
                            <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Pay Type</label>
                            <div style={{ display: "flex", gap: 8 }}>
                              {["Fixed", "Hourly"].map(pt => (
                                <button key={pt} onClick={() => setBrkConfig(prev => ({ ...prev, payType: pt }))} style={{ flex: 1, padding: "8px", borderRadius: 8, border: `2px solid ${(brkConfig.payType || "Fixed") === pt ? T.accent : T.border2}`, background: (brkConfig.payType || "Fixed") === pt ? `${T.accent}22` : "transparent", color: (brkConfig.payType || "Fixed") === pt ? T.accentHi : T.textMid, cursor: "pointer", fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, letterSpacing: 2, transition: "all .15s" }}>{pt}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* WRK checkbox + config */}
                    <div style={{ marginTop: 10, padding: "10px 14px", background: T.surface2, borderRadius: 7, border: `1px solid ${includeWRK ? T.accent : T.border}`, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setIncludeWRK(d => !d)}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${includeWRK ? T.accent : T.border2}`, background: includeWRK ? T.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {includeWRK && <span style={{ color: "#000", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: includeWRK ? T.text : T.textMid, fontWeight: 600 }}>Also generate WRK (Walk In Ready Kit) work order on Day 1</div>
                        <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>Creates 1 WRK WO per site on Day 1 · configure below when enabled</div>
                      </div>
                    </div>
                    {includeWRK && (
                      <div style={{ marginTop: 10, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1rem" }}>
                        <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>WRK Work Order Config</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div style={{ position: "relative" }}>
                            <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Template ID</label>
                            <div style={{ display: "flex", gap: 6 }}>
                              <input style={{ ...T.inp, flex: 1 }} placeholder="" value={wrkConfig.templateId || ""} onChange={e => setWrkConfig(prev => ({ ...prev, templateId: e.target.value }))} onFocus={e => { e.target.style.borderColor=T.accent; }} onBlur={e => { e.target.style.borderColor=T.border2; setTimeout(() => setShowWrkTidDropdown(false), 150); }} />
                              {(templateIdHistory["WRK"]?.length > 0) && (
                                <button onClick={() => setShowWrkTidDropdown(d => !d)} style={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 7, padding: "0 10px", color: T.textMid, cursor: "pointer", fontSize: 13, flexShrink: 0 }} title="Recent WRK template IDs">▾</button>
                              )}
                            </div>
                            {showWrkTidDropdown && templateIdHistory["WRK"]?.length > 0 && (
                              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 7, zIndex: 100, marginTop: 3, overflow: "hidden" }}>
                                {templateIdHistory["WRK"].map((entry) => {
                                  const tid = typeof entry === "string" ? entry : entry.id;
                                  const lbl = typeof entry === "string" ? "" : entry.label;
                                  return (
                                    <div key={tid} onClick={() => { setWrkConfig(prev => ({ ...prev, templateId: tid })); setShowWrkTidDropdown(false); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }} onMouseEnter={e => e.currentTarget.style.background=T.rowHover} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                                      <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{tid}</span>
                                      {lbl && <span style={{ fontSize: 11, color: T.textDim, marginLeft: 8 }}>{lbl}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <input style={{ ...T.inp, marginTop: 4, fontSize: 10 }} placeholder="Label (e.g. PNC WRK)" value={wrkTidLabelInput} onChange={e => setWrkTidLabelInput(e.target.value)} onFocus={e => e.target.style.borderColor=T.accent} onBlur={e => e.target.style.borderColor=T.border2} />
                          </div>
                          {[{ key: "startTime", label: "Scheduled Start Time", ph: "13:00:00" }, { key: "date", label: "Override Date", ph: "", type: "date" }, { key: "techType", label: "Tech Type", ph: "Tech 1" }, { key: "budgetTech", label: "Budget (Tech) $", ph: "200" }, { key: "payRate", label: "Pay Rate $", ph: "150" }, { key: "approxHours", label: "Est. Hours", ph: "3" }, { key: "country", label: "Country", ph: "" }].map(({ key, label, ph, type }) => (
                            <div key={key}>
                              <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{label}</label>
                              <input style={T.inp} type={type || "text"} placeholder={ph} value={wrkConfig[key] || ""} onChange={e => setWrkConfig(prev => ({ ...prev, [key]: e.target.value }))} onFocus={e => e.target.style.borderColor=T.accent} onBlur={e => e.target.style.borderColor=T.border2} />
                              {key === "date" && <div style={{ fontSize: 10, color: T.textFaint, marginTop: 3 }}>Leave blank to use each site's Day 1 date</div>}
                            </div>
                          ))}
                          <div style={{ gridColumn: "span 2" }}>
                            <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Pay Type</label>
                            <div style={{ display: "flex", gap: 8 }}>
                              {["Fixed", "Hourly"].map(pt => (
                                <button key={pt} onClick={() => setWrkConfig(prev => ({ ...prev, payType: pt }))} style={{ flex: 1, padding: "8px", borderRadius: 8, border: `2px solid ${(wrkConfig.payType || "Fixed") === pt ? T.accent : T.border2}`, background: (wrkConfig.payType || "Fixed") === pt ? `${T.accent}22` : "transparent", color: (wrkConfig.payType || "Fixed") === pt ? T.accentHi : T.textMid, cursor: "pointer", fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, letterSpacing: 2, transition: "all .15s" }}>{pt}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* DEL checkbox + config */}
                    <div style={{ marginTop: 10, padding: "10px 14px", background: T.surface2, borderRadius: 7, border: `1px solid ${includeDEL ? T.accent : T.border}`, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setIncludeDEL(d => !d)}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${includeDEL ? T.accent : T.border2}`, background: includeDEL ? T.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {includeDEL && <span style={{ color: "#000", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: includeDEL ? T.text : T.textMid, fontWeight: 600 }}>Also generate DEL work order on Day 1</div>
                        <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>Creates 1 DEL WO per site on Day 1 · configure below when enabled</div>
                      </div>
                    </div>
                    {includeDEL && (
                      <div style={{ marginTop: 10, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1rem" }}>
                        <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>DEL Work Order Config</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          {/* Template ID with history dropdown */}
                          <div style={{ position: "relative" }}>
                            <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Template ID</label>
                            <div style={{ display: "flex", gap: 6 }}>
                              <input
                                style={{ ...T.inp, flex: 1 }}
                                placeholder="102221"
                                value={delConfig.templateId || ""}
                                onChange={e => setDelConfig(prev => ({ ...prev, templateId: e.target.value }))}
                                onFocus={e => { e.target.style.borderColor=T.accent; }}
                                onBlur={e => { e.target.style.borderColor=T.border2; setTimeout(() => setShowDelTidDropdown(false), 150); }}
                              />
                              {(templateIdHistory["DEL"]?.length > 0) && (
                                <button onClick={() => setShowDelTidDropdown(d => !d)} style={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 7, padding: "0 10px", color: T.textMid, cursor: "pointer", fontSize: 13, flexShrink: 0 }} title="Recent DEL template IDs">▾</button>
                              )}
                            </div>
                            <input style={{ ...T.inp, marginTop: 4, fontSize: 10 }} placeholder="Label (e.g. PNC DEL)" value={delTidLabelInput} onChange={e => setDelTidLabelInput(e.target.value)} onFocus={e => e.target.style.borderColor=T.accent} onBlur={e => e.target.style.borderColor=T.border2} />
                            {showDelTidDropdown && templateIdHistory["DEL"]?.length > 0 && (
                              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 7, zIndex: 100, marginTop: 3, overflow: "hidden" }}>
                                {templateIdHistory["DEL"].map((entry) => {
                                  const tid = typeof entry === "string" ? entry : entry.id;
                                  const lbl = typeof entry === "string" ? "" : entry.label;
                                  return (
                                    <div key={tid} onClick={() => { setDelConfig(prev => ({ ...prev, templateId: tid })); setShowDelTidDropdown(false); }}
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
                          </div>
                          {/* Remaining DEL config fields */}
                          {[
                            { key: "startTime",   label: "Scheduled Start Time", ph: "13:00:00" },
                            { key: "date",        label: "Override Date",        ph: "", type: "date" },
                            { key: "techType",    label: "Tech Type",            ph: "Tech 1" },
                            { key: "budgetTech",  label: "Budget (Tech) $",      ph: "200" },
                            { key: "payRate",     label: "Pay Rate $",           ph: "150" },
                            { key: "approxHours", label: "Est. Hours",           ph: "3" },
                            { key: "country",     label: "Country",              ph: "" },
                          ].map(({ key, label, ph, type }) => (
                            <div key={key}>
                              <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{label}</label>
                              <input
                                style={T.inp}
                                type={type || "text"}
                                placeholder={ph}
                                value={delConfig[key] || ""}
                                onChange={e => setDelConfig(prev => ({ ...prev, [key]: e.target.value }))}
                                onFocus={e => e.target.style.borderColor=T.accent}
                                onBlur={e => e.target.style.borderColor=T.border2}
                              />
                              {key === "date" && <div style={{ fontSize: 10, color: T.textFaint, marginTop: 3 }}>Leave blank to use each site's Day 1 date</div>}
                            </div>
                          ))}
                          {/* DEL Pay Type toggle */}
                          <div style={{ gridColumn: "span 2" }}>
                            <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Pay Type</label>
                            <div style={{ display: "flex", gap: 8 }}>
                              {["Fixed", "Hourly"].map(pt => (
                                <button key={pt} onClick={() => setDelConfig(prev => ({ ...prev, payType: pt }))}
                                  style={{ flex: 1, padding: "8px", borderRadius: 8, border: `2px solid ${(delConfig.payType || "Fixed") === pt ? T.accent : T.border2}`, background: (delConfig.payType || "Fixed") === pt ? `${T.accent}22` : "transparent", color: (delConfig.payType || "Fixed") === pt ? T.accentHi : T.textMid, cursor: "pointer", fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, letterSpacing: 2, transition: "all .15s" }}>
                                  {pt}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                {null}
                </div>
              </div>
            </div>
        )}
  );
}
