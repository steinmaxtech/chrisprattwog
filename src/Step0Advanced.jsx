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

export default function Step0Advanced({ T, woType, setWoType, setWoConfig, WO_DEFAULTS, ALL_WO_TYPES, WO_TYPES, woConfig, projectId, setProjectId, displayName, setDisplayName, projectIdHistory, showPidDropdown, setShowPidDropdown, displayNameHistory, showDnDropdown, setShowDnDropdown, woTemplates, setShowTemplatePanel, adminUnlocked, templateIdHistory, showTidDropdown, setShowTidDropdown, FN_TEMPLATE_BANK, saveTemplateId, includeDEL, setIncludeDEL, delConfig, setDelConfig, showDelTidDropdown, setShowDelTidDropdown, delTidLabelInput, setDelTidLabelInput, includeBRK, setIncludeBRK, brkConfig, setBrkConfig, showBrkTidDropdown, setShowBrkTidDropdown, brkTidLabelInput, setBrkTidLabelInput, includeWRK, setIncludeWRK, wrkConfig, setWrkConfig, showWrkTidDropdown, setShowWrkTidDropdown, wrkTidLabelInput, setWrkTidLabelInput, setGuidedMode, guidedMode, deletedBuiltins, setDeleteConfirm, setDeletePw, setDeletePwError, setEditingCustomKey, setCustomForm, setShowCustomModal, setShowRecoverModal, isPastDate, overriddenBuiltins }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => { const next = !guidedMode; setGuidedMode(next); try { localStorage.setItem("cpwog_guided", next ? "1" : "0"); } catch {} }} style={{ fontSize: 11, color: T.textFaint, background: "transparent", border: `1px solid ${T.border2}`, borderRadius: 20, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}>✦ Switch to Guided Mode</button>
      </div>

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
        </div>
      </div>
      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 6 }}>Prefix used in FieldNation location names</div>

      <div style={{ background: T.surface, borderRadius: 12, padding: "1.5rem", border: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2 }}>Work Order Type</div>
          {woTemplates.length > 0 && <button onClick={() => setShowTemplatePanel(true)} style={{ fontSize: 11, color: T.accent, background: "transparent", border: `1px solid ${T.accent}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>📋 Use Template</button>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={woType} onChange={e => { const k=e.target.value; const wot=ALL_WO_TYPES[k]||{}; setWoType(k); setWoConfig(WO_DEFAULTS[k]?{...WO_DEFAULTS[k]}:{templateId:"",startTime:"",defaultDate:"",techType:"Tech",numTechs:wot.numTechs?.toString()||"1",numDays:wot.numDays?.toString()||"1",budgetTech:"",payRate:"",approxHours:"",country:"US",payType:"Fixed"}); }} style={{ flex:1, ...T.inp, fontSize:14, height:42, fontFamily:"inherit" }}>
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
        {woType && (() => { const wot=ALL_WO_TYPES[woType]||{}; return <div style={{ fontSize:11, color:T.textFaint, marginTop:6 }}>{wot.numTechs} tech{wot.numTechs>1?"s":""} × {wot.numDays} day{wot.numDays>1?"s":""}</div>; })()}
        {adminUnlocked && <button onClick={() => { setEditingCustomKey(null); setCustomForm({key:"",label:"",siteIdSuffix:"",numTechs:"1",numDays:"1",useBundle:false}); setShowCustomModal(true); }} style={{ marginTop:8, width:"100%", background:"transparent", border:`1px dashed ${T.border2}`, borderRadius:10, padding:"10px", color:T.textDim, cursor:"pointer", fontSize:12, fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }} onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border2}><span style={{fontSize:16}}>＋</span> Add Custom WO Type</button>}
        {adminUnlocked && Object.keys(deletedBuiltins||{}).length>0 && <button onClick={()=>setShowRecoverModal(true)} style={{ marginTop:6, width:"100%", background:"transparent", border:"1px dashed #22c55e", borderRadius:10, padding:"8px", color:"#22c55e", cursor:"pointer", fontSize:12, fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>↩ Recover Deleted ({Object.keys(deletedBuiltins||{}).length})</button>}
      </div>

      {woType && (() => {
        const isSdt = woType === "SDT";
        const sdtGreyed = new Set(["startTime","numTechs","numDays","budgetTech","payRate","approxHours"]);
        return (
        <div style={{ background: T.surface, borderRadius: 12, padding: "1.5rem", border: `1px solid ${T.border}`, opacity: 1 }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
            Work Order Config
            {isSdt && <span style={{ marginLeft: 8, color: "#f59e0b", fontSize: 9 }}>· dimmed fields controlled by SDT Schedule below</span>}
          </div>
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
            ].map(({key,lbl,ph,type}) => {
              const dimmed = isSdt && sdtGreyed.has(key);
              return (
                <div key={key} style={{ opacity: dimmed ? 0.35 : 1, pointerEvents: dimmed ? "none" : "auto" }}>
                  <label style={{ display:"block", fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>{lbl}</label>
                  <input type={type||"text"} placeholder={ph||""} value={woConfig[key]||""} onChange={e=>setWoConfig(p=>({...p,[key]:e.target.value}))} onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border2} style={T.inp} />
                </div>
              );
            })}
            <div style={{ opacity: isSdt ? 0.35 : 1, pointerEvents: isSdt ? "none" : "auto", gridColumn:"span 2" }}>
              <PayTypeToggle value={woConfig.payType} onChange={v=>setWoConfig(p=>({...p,payType:v}))} T={T} />
            </div>
          </div>
          <div style={{ marginTop:12, padding:"8px 12px", background:T.surface2, borderRadius:7, fontSize:11, color:T.textFaint }}>
            {isSdt
              ? <span>Template: <span style={{color:T.textMid}}>{woConfig.templateId||"—"}</span> · Start date set per site in table</span>
              : <span>Pattern: <span style={{color:T.textMid}}>{woConfig.numTechs} tech{Number(woConfig.numTechs)>1?"s":""} × {woConfig.numDays} day{Number(woConfig.numDays)>1?"s":""}</span> · Template: <span style={{color:T.textMid}}>{woConfig.templateId||"—"}</span></span>
            }
          </div>
        </div>
        );
      })()}

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
