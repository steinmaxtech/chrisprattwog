import React from "react";

function FieldInput({ label, value, onChange, ph, type, hint, T }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{label}</label>
      <input style={T.inp} type={type || "text"} placeholder={ph || ""} value={value || ""} onChange={onChange} onFocus={e => e.target.style.borderColor=T.accent} onBlur={e => e.target.style.borderColor=T.border2} />
      {hint && <div style={{ fontSize: 10, color: T.textFaint, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function PayTypeToggle({ value, onChange, T }) {
  const active = value || "Fixed";
  return (
    <div style={{ gridColumn: "span 2" }}>
      <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Pay Type</label>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onChange("Fixed")} style={{ flex:1, padding:"8px", borderRadius:8, border:`2px solid ${active==="Fixed"?"#e97316":"#404040"}`, background:active==="Fixed"?"rgba(234,88,12,0.13)":"transparent", color:active==="Fixed"?"#fb923c":"#9ca3af", cursor:"pointer", fontFamily:"'Bebas Neue',sans-serif", fontSize:15, letterSpacing:2 }}>Fixed</button>
        <button onClick={() => onChange("Hourly")} style={{ flex:1, padding:"8px", borderRadius:8, border:`2px solid ${active==="Hourly"?"#e97316":"#404040"}`, background:active==="Hourly"?"rgba(234,88,12,0.13)":"transparent", color:active==="Hourly"?"#fb923c":"#9ca3af", cursor:"pointer", fontFamily:"'Bebas Neue',sans-serif", fontSize:15, letterSpacing:2 }}>Hourly</button>
      </div>
    </div>
  );
}

function ScheduleToggleRow({ checked, onClick, label, T }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "6px 0" }}>
      <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${checked ? T.accent : T.border2}`, background: checked ? T.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {checked && <span style={{ color: "#000", fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
      </div>
      <span style={{ fontSize: 11, color: checked ? T.text : T.textMid }}>{label}</span>
    </div>
  );
}

function ScheduleConfig({ cfg, setConfig, T }) {
  const numDays = Math.max(1, Math.min(7, Number(cfg.numDays) || 1));
  const days = Array.from({ length: numDays }, (_, i) => i);
  const startTimes = cfg.startTimes || [];
  const endTimes = cfg.endTimes || [];
  return (
    <div style={{ gridColumn: "span 2", borderTop: `1px solid ${T.border}`, paddingTop: 10, marginTop: 4 }}>
      <ScheduleToggleRow checked={!!cfg.perDayTimes} onClick={() => setConfig(p => ({ ...p, perDayTimes: !p.perDayTimes }))} label="Use a different start time for each day" T={T} />
      {cfg.perDayTimes && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${numDays}, 1fr)`, gap: 8, marginTop: 6, marginBottom: 6 }}>
          {days.map(d => (
            <div key={d}>
              <label style={{ display: "block", fontSize: 9, color: T.textFaint, marginBottom: 3 }}>Day {d + 1} Start</label>
              <input style={{ ...T.inp, fontSize: 12 }} placeholder="1:00pm" value={startTimes[d] || ""} onChange={e => { const arr = [...startTimes]; arr[d] = e.target.value; setConfig(p => ({ ...p, startTimes: arr })); }} onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.border2} />
            </div>
          ))}
        </div>
      )}
      <ScheduleToggleRow checked={!!cfg.checkInWindow} onClick={() => setConfig(p => ({ ...p, checkInWindow: !p.checkInWindow }))} label="Check-in window (start + end time) instead of a hard start" T={T} />
      {cfg.checkInWindow && !cfg.perDayTimes && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
          <div>
            <label style={{ display: "block", fontSize: 9, color: T.textFaint, marginBottom: 3 }}>Window Start</label>
            <input style={{ ...T.inp, fontSize: 12 }} placeholder="1:00pm" value={cfg.startTime || ""} onChange={e => setConfig(p => ({ ...p, startTime: e.target.value }))} onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.border2} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 9, color: T.textFaint, marginBottom: 3 }}>Window End</label>
            <input style={{ ...T.inp, fontSize: 12 }} placeholder="5:00pm" value={cfg.endTime || ""} onChange={e => setConfig(p => ({ ...p, endTime: e.target.value }))} onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.border2} />
          </div>
        </div>
      )}
      {cfg.checkInWindow && cfg.perDayTimes && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${numDays}, 1fr)`, gap: 8, marginTop: 6 }}>
          {days.map(d => (
            <div key={d}>
              <label style={{ display: "block", fontSize: 9, color: T.textFaint, marginBottom: 3 }}>Day {d + 1} End</label>
              <input style={{ ...T.inp, fontSize: 12 }} placeholder="5:00pm" value={endTimes[d] || ""} onChange={e => { const arr = [...endTimes]; arr[d] = e.target.value; setConfig(p => ({ ...p, endTimes: arr })); }} onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.border2} />
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 10, color: T.textFaint, marginTop: 8 }}>{cfg.checkInWindow ? "Rows include a start AND end time (check-in window)." : "Rows use a single hard start time."}{cfg.perDayTimes ? " Per-day times override the Start Time field above." : ""}</div>
    </div>
  );
}

function TidDropdown({ value, onChange, history, bank, show, setShow, tidLabel, setTidLabel, labelPh, T }) {
  return (
    <div style={{ position: "relative" }}>
      <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Template ID</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input style={{ ...T.inp, flex: 1 }} placeholder="" value={value || ""} onChange={e => onChange(e.target.value)} onFocus={e => e.target.style.borderColor=T.accent} onBlur={e => { e.target.style.borderColor=T.border2; setTimeout(() => setShow(false), 150); }} />
        <button onClick={() => setShow(d => !d)} style={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 7, padding: "0 10px", color: T.textMid, cursor: "pointer", fontSize: 13 }}>▾</button>
      </div>
      {show && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 7, zIndex: 100, marginTop: 3, maxHeight: 280, overflowY: "auto" }}>
          {(bank || []).map(t => (
            <div key={t.id} onClick={() => { onChange(t.id); setShow(false); }} style={{ padding: "9px 12px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }} onMouseEnter={e => e.currentTarget.style.background=T.rowHover} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
              <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{t.id}</span>
              <span style={{ fontSize: 11, color: T.textDim }}>{t.name}</span>
            </div>
          ))}
          {(history || []).filter(e => !(bank||[]).find(t => t.id === (typeof e==="string"?e:e.id))).map(entry => {
            const tid = typeof entry==="string"?entry:entry.id;
            const lbl = typeof entry==="string"?"":entry.label;
            return (
              <div key={tid} onClick={() => { onChange(tid); setShow(false); }} style={{ padding: "9px 12px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }} onMouseEnter={e => e.currentTarget.style.background=T.rowHover} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{tid}</span>
                {lbl && <span style={{ fontSize: 11, color: T.textDim }}>{lbl}</span>}
              </div>
            );
          })}
        </div>
      )}
      <input style={{ ...T.inp, marginTop: 4, fontSize: 10 }} placeholder={labelPh || "Label"} value={tidLabel || ""} onChange={e => setTidLabel(e.target.value)} onFocus={e => e.target.style.borderColor=T.accent} onBlur={e => e.target.style.borderColor=T.border2} />
    </div>
  );
}

function CompanionConfig({ label, config, setConfig, tidHistory, showTid, setShowTid, tidLabel, setTidLabel, FN_TEMPLATE_BANK, T }) {
  const fields = [
    { key: "startTime",   lbl: "Start Time",    ph: "1:00pm" },
    { key: "date",        lbl: "Override Date", ph: "", type: "date", hint: "Leave blank to use site Day 1 date" },
    { key: "techType",    lbl: "Tech Type",     ph: "Tech" },
    { key: "budgetTech",  lbl: "Budget $",      ph: "200" },
    { key: "payRate",     lbl: "Pay Rate $",    ph: "150" },
    { key: "approxHours", lbl: "Est. Hours",    ph: "3" },
    { key: "country",     lbl: "Country",       ph: "US" },
  ];
  return (
    <div style={{ marginTop: 10, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1rem" }}>
      <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>{label} Config</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <TidDropdown value={config.templateId} onChange={v => setConfig(p => ({...p, templateId: v}))} history={tidHistory} bank={FN_TEMPLATE_BANK} show={showTid} setShow={setShowTid} tidLabel={tidLabel} setTidLabel={setTidLabel} labelPh={"Label (e.g. PNC " + label + ")"} T={T} />
        {fields.map(({ key, lbl, ph, type, hint }) => (
          <FieldInput key={key} label={lbl} value={config[key]} onChange={e => setConfig(p => ({...p, [key]: e.target.value}))} ph={ph} type={type} hint={hint} T={T} />
        ))}
        <PayTypeToggle value={config.payType} onChange={v => setConfig(p => ({...p, payType: v}))} T={T} />
      </div>
    </div>
  );
}

function CompanionToggle({ flag, setFlag, label, desc, children, T }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ padding: "10px 14px", background: T.surface2, borderRadius: 7, border: `1px solid ${flag ? T.accent : T.border}`, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setFlag(d => !d)}>
        <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${flag ? T.accent : T.border2}`, background: flag ? T.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {flag && <span style={{ color: "#000", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
        </div>
        <div>
          <div style={{ fontSize: 12, color: flag ? T.text : T.textMid, fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>{desc}</div>
        </div>
      </div>
      {flag && children}
      <div style={{ height: 1 }} />
    </div>
  );
}

export default function Step0Advanced({ T, woType, setWoType, setWoConfig, WO_DEFAULTS, ALL_WO_TYPES, WO_TYPES, woConfig, projectId, setProjectId, displayName, setDisplayName, projectIdHistory, showPidDropdown, setShowPidDropdown, displayNameHistory, showDnDropdown, setShowDnDropdown, woTemplates, setShowTemplatePanel, adminUnlocked, templateIdHistory, showTidDropdown, setShowTidDropdown, FN_TEMPLATE_BANK, saveTemplateId, includeDEL, setIncludeDEL, delConfig, setDelConfig, showDelTidDropdown, setShowDelTidDropdown, delTidLabelInput, setDelTidLabelInput, includeBRK, setIncludeBRK, brkConfig, setBrkConfig, showBrkTidDropdown, setShowBrkTidDropdown, brkTidLabelInput, setBrkTidLabelInput, includeWRK, setIncludeWRK, wrkConfig, setWrkConfig, showWrkTidDropdown, setShowWrkTidDropdown, wrkTidLabelInput, setWrkTidLabelInput, deletedBuiltins, setDeleteConfirm, setDeletePw, setDeletePwError, setEditingCustomKey, setCustomForm, setShowCustomModal, setShowRecoverModal, isPastDate, overriddenBuiltins }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>

      <div style={{ background: T.surface, borderRadius: 12, padding: "1.5rem", border: `1px solid ${T.border}` }}>
        <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>Project ID</label>
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input style={{ ...T.inp, flex: 1 }} placeholder="e.g. 10035574 - 4569395 - PNC" value={projectId} onChange={e => { setProjectId(e.target.value); if (!displayName || displayName === projectId) setDisplayName(e.target.value); }} onFocus={e => e.target.style.borderColor=T.accent} onBlur={e => { e.target.style.borderColor=T.border2; setTimeout(() => setShowPidDropdown(false), 150); }} />
            {projectIdHistory.length > 0 && <button onClick={() => setShowPidDropdown(d => !d)} style={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 7, padding: "0 10px", color: T.textMid, cursor: "pointer", fontSize: 13 }}>▾</button>}
          </div>
          {showPidDropdown && projectIdHistory.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 7, zIndex: 100, marginTop: 3, maxHeight: 200, overflowY: "auto" }}>
              {projectIdHistory.map(pid => (
                <div key={pid} onClick={() => { setProjectId(pid); if (!displayName || displayName === projectId) setDisplayName(pid); setShowPidDropdown(false); }} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 12, color: T.textMid, borderBottom: `1px solid ${T.border}` }} onMouseEnter={e => e.currentTarget.style.background=T.rowHover} onMouseLeave={e => e.currentTarget.style.background="transparent"}>{pid}</div>
              ))}
            </div>
          )}
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>Location Display Name Prefix</label>
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input style={{ ...T.inp, flex: 1 }} placeholder="Prefix used in FN location names" value={displayName} onChange={e => setDisplayName(e.target.value)} onFocus={e => e.target.style.borderColor=T.accent} onBlur={e => { e.target.style.borderColor=T.border2; setTimeout(() => setShowDnDropdown(false), 150); }} />
              {(displayNameHistory||[]).length > 0 && <button onClick={() => setShowDnDropdown(d => !d)} style={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 7, padding: "0 10px", color: T.textMid, cursor: "pointer", fontSize: 13 }}>▾</button>}
            </div>
            {showDnDropdown && (displayNameHistory||[]).length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 7, zIndex: 100, marginTop: 3, maxHeight: 200, overflowY: "auto" }}>
                {(displayNameHistory||[]).map(dn => (
                  <div key={dn} onClick={() => { setDisplayName(dn); setShowDnDropdown(false); }} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 12, color: T.textMid, borderBottom: `1px solid ${T.border}` }} onMouseEnter={e => e.currentTarget.style.background=T.rowHover} onMouseLeave={e => e.currentTarget.style.background="transparent"}>{dn}</div>
                ))}
              </div>
            )}
          </div>
          <div style={{ fontSize: 10, color: "#6b7280", marginTop: 6 }}>Prefix used in FieldNation location names</div>
        </div>
      </div>

      <div style={{ background: T.surface, borderRadius: 12, padding: "1.5rem", border: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2 }}>Work Order Type</div>
          {woTemplates.length > 0 && <button onClick={() => setShowTemplatePanel(true)} style={{ fontSize: 11, color: T.accent, background: "transparent", border: `1px solid ${T.accent}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>📋 Use Template</button>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={woType} onChange={e => { const k=e.target.value; const wot=ALL_WO_TYPES[k]||{}; setWoType(k); setWoConfig(WO_DEFAULTS[k]?{...WO_DEFAULTS[k]}:{templateId:"",startTime:"",endTime:"",defaultDate:"",techType:"Tech",numTechs:wot.numTechs?.toString()||"1",numDays:wot.numDays?.toString()||"1",budgetTech:"",payRate:"",approxHours:"",country:"US",payType:"Fixed",perDayTimes:false,startTimes:["","","","","","",""],checkInWindow:false,endTimes:["","","","","","",""]}); }} style={{ flex:1, ...T.inp, fontSize:14, height:42, fontFamily:"inherit" }}>
            {Object.entries(ALL_WO_TYPES).map(([key,wot]) => (
              <option key={key} value={key}>{key} — {(wot.label||key).replace(/^[A-Z]+ — /,"")}</option>
            ))}
          </select>
          {adminUnlocked && woType && (
            <div style={{ display:"flex", gap:4 }}>
              <button onClick={() => { setEditingCustomKey(woType); const wot=ALL_WO_TYPES[woType]||{}; setCustomForm({key:woType,label:wot.label||"",siteIdSuffix:wot.siteIdSuffix||woType,numTechs:wot.numTechs?.toString()||"1",numDays:wot.numDays?.toString()||"1",useBundle:!!wot.useBundle}); setShowCustomModal(true); }} style={{ background:"transparent", border:`1px solid ${T.border2}`, borderRadius:7, padding:"0 12px", color:T.textDim, cursor:"pointer", fontSize:11, height:42 }}>edit</button>
              <button onClick={() => { setDeletePw(""); setDeletePwError(false); setDeleteConfirm({key:woType,isBuiltin:!!WO_TYPES[woType]}); }} style={{ background:"transparent", border:"1px solid #ef4444", borderRadius:7, padding:"0 12px", color:"#ef4444", cursor:"pointer", fontSize:11, height:42 }}>delete</button>
            </div>
          )}
        </div>
        {woType && (() => { const wot=ALL_WO_TYPES[woType]||{}; if (woType==="SDT") return <div style={{ fontSize:11, color:T.textFaint, marginTop:6 }}>9 work orders × 3 days (fixed schedule, bundled AH/BH)</div>; return <div style={{ fontSize:11, color:T.textFaint, marginTop:6 }}>{wot.numTechs} tech{wot.numTechs>1?"s":""} × {wot.numDays} day{wot.numDays>1?"s":""}</div>; })()}
        {adminUnlocked && <button onClick={() => { setEditingCustomKey(null); setCustomForm({key:"",label:"",siteIdSuffix:"",numTechs:"1",numDays:"1",useBundle:false}); setShowCustomModal(true); }} style={{ marginTop:8, width:"100%", background:"transparent", border:`1px dashed ${T.border2}`, borderRadius:10, padding:"10px", color:T.textDim, cursor:"pointer", fontSize:12, fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }} onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border2}><span style={{fontSize:16}}>＋</span> Add Custom WO Type</button>}
        {adminUnlocked && Object.keys(deletedBuiltins||{}).length>0 && <button onClick={()=>setShowRecoverModal(true)} style={{ marginTop:6, width:"100%", background:"transparent", border:"1px dashed #22c55e", borderRadius:10, padding:"8px", color:"#22c55e", cursor:"pointer", fontSize:12, fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>↩ Recover Deleted ({Object.keys(deletedBuiltins||{}).length})</button>}
      </div>

      {woType && woType !== "SDT" && (
        <div style={{ background: T.surface, borderRadius: 12, padding: "1.5rem", border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Work Order Config</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <TidDropdown value={woConfig.templateId} onChange={v=>setWoConfig(p=>({...p,templateId:v}))} history={templateIdHistory[woType]} bank={FN_TEMPLATE_BANK} show={showTidDropdown} setShow={setShowTidDropdown} tidLabel="" setTidLabel={()=>{}} labelPh="Label" T={T} />
            {[
              {key:"startTime",lbl:"Start Time",ph:"1:00pm"},
              {key:"defaultDate",lbl:"Default Start Date",ph:"",type:"date"},
              {key:"techType",lbl:"Tech Type",ph:"Tech"},
              {key:"numTechs",lbl:"Techs per Site",ph:"1"},
              {key:"numDays",lbl:"Days per Site",ph:"1"},
              {key:"budgetTech",lbl:"Budget $",ph:""},
              {key:"payRate",lbl:"Pay Rate $",ph:""},
              {key:"approxHours",lbl:"Est. Hours",ph:"3"},
              {key:"country",lbl:"Country",ph:"US"},
            ].map(({key,lbl,ph,type}) => (
              <FieldInput key={key} label={lbl} value={woConfig[key]} onChange={e=>setWoConfig(p=>({...p,[key]:e.target.value}))} ph={ph} type={type} T={T} />
            ))}
            <PayTypeToggle value={woConfig.payType} onChange={v=>setWoConfig(p=>({...p,payType:v}))} T={T} />
            <ScheduleConfig cfg={woConfig} setConfig={setWoConfig} T={T} />
          </div>
          <div style={{ marginTop:12, padding:"8px 12px", background:T.surface2, borderRadius:7, fontSize:11, color:T.textFaint }}>
            Pattern: <span style={{color:T.textMid}}>{woConfig.numTechs} tech{Number(woConfig.numTechs)>1?"s":""} × {woConfig.numDays} day{Number(woConfig.numDays)>1?"s":""}</span> · Template: <span style={{color:T.textMid}}>{woConfig.templateId||"—"}</span>
          </div>
        </div>
      )}

      {woType === "SDT" && (
        <div style={{ background: T.surface, borderRadius: 12, padding: "1.5rem", border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Work Order Config — SDT</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <TidDropdown value={woConfig.templateId} onChange={v=>setWoConfig(p=>({...p,templateId:v}))} history={templateIdHistory[woType]} bank={FN_TEMPLATE_BANK} show={showTidDropdown} setShow={setShowTidDropdown} tidLabel="" setTidLabel={()=>{}} labelPh="Label" T={T} />
            <FieldInput label="Default Start Date" value={woConfig.defaultDate} onChange={e=>setWoConfig(p=>({...p,defaultDate:e.target.value}))} ph="" type="date" T={T} />
            <FieldInput label="Tech Type" value={woConfig.techType} onChange={e=>setWoConfig(p=>({...p,techType:e.target.value}))} ph="Tech" T={T} />
            <FieldInput label="Country" value={woConfig.country} onChange={e=>setWoConfig(p=>({...p,country:e.target.value}))} ph="US" T={T} />
          </div>
          <div style={{ marginTop: 12, padding: "10px 12px", background: T.surface2, borderRadius: 7, fontSize: 11, color: T.textFaint, lineHeight: 1.7 }}>
            SDT generates a fixed <span style={{color:T.textMid}}>9-row, 3-day schedule</span> per site (1 AH on Day 1, then 2 BH + 2 AH on Days 2 and 3), bundled separately by AH/BH group. Site IDs follow <span style={{color:T.textMid}}>xxxx-SDT-AH(#)</span> / <span style={{color:T.textMid}}>xxxx-SDT-BH(#)</span>. Pay is Fixed per row ($450–$650) and isn't configurable here.
          </div>
        </div>
      )}

      <div style={{ background: T.surface, borderRadius: 12, padding: "1.5rem", border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>Companion Work Orders</div>
        <CompanionToggle flag={includeWRK} setFlag={setIncludeWRK} label="Also generate WRK (Walk In Ready Kit) on Day 1" desc="1 WRK WO per site · configure below" T={T}>
          <CompanionConfig label="WRK" config={wrkConfig} setConfig={setWrkConfig} tidHistory={[]} showTid={showWrkTidDropdown} setShowTid={setShowWrkTidDropdown} tidLabel={wrkTidLabelInput} setTidLabel={setWrkTidLabelInput} FN_TEMPLATE_BANK={FN_TEMPLATE_BANK} T={T} />
        </CompanionToggle>
        <CompanionToggle flag={includeBRK} setFlag={setIncludeBRK} label="Also generate BRK (Backboard) on Day 1" desc="1 BRK WO per site · configure below" T={T}>
          <CompanionConfig label="BRK" config={brkConfig} setConfig={setBrkConfig} tidHistory={[]} showTid={showBrkTidDropdown} setShowTid={setShowBrkTidDropdown} tidLabel={brkTidLabelInput} setTidLabel={setBrkTidLabelInput} FN_TEMPLATE_BANK={FN_TEMPLATE_BANK} T={T} />
        </CompanionToggle>
        <CompanionToggle flag={includeDEL} setFlag={setIncludeDEL} label="Also generate DEL (Delivery) on Day 1" desc="1 DEL WO per site · configure below" T={T}>
          <CompanionConfig label="DEL" config={delConfig} setConfig={setDelConfig} tidHistory={[]} showTid={showDelTidDropdown} setShowTid={setShowDelTidDropdown} tidLabel={delTidLabelInput} setTidLabel={setDelTidLabelInput} FN_TEMPLATE_BANK={FN_TEMPLATE_BANK} T={T} />
        </CompanionToggle>
      </div>

    </div>
  );
}
