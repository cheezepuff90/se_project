import { useState, useCallback, useEffect, useRef } from "react";
import "./App.css";

const LANGS = {
  python: {
    label: "Python", ext: ".py", color: "#3b82f6", mime: "text/x-python",
    keywords: ["if","elif","else","for","while","def","class","return","import","from","with","as","try","except","finally","raise","pass","yield","lambda","and","or","not","in","is","True","False","None","break","continue","global","nonlocal","del","assert","async","await"],
    operators: ["+","-","*","/","//","**","%","=","==","!=","<",">","<=",">=","&","|","^","~","<<",">>","+=","-=","*=","/=","//=","**=","%=","->",":=","@"],
    commentSingle: "#",
  },
  java: {
    label: "Java", ext: ".java", color: "#f59e0b", mime: "text/x-java",
    keywords: ["if","else","for","while","do","switch","case","break","continue","return","class","interface","extends","implements","new","this","super","static","final","public","private","protected","void","int","long","double","float","boolean","char","byte","short","try","catch","finally","throw","throws","import","package","instanceof","abstract","enum","synchronized","volatile","transient"],
    operators: ["+","-","*","/","%","=","==","!=","<",">","<=",">=","&&","||","!","&","|","^","~","<<",">>",">>>","++","--","+=","-=","*=","/=","%=","?",":","::","->"],
    commentSingle: "//",
  },
  c: {
    label: "C", ext: ".c", color: "#6366f1", mime: "text/x-c",
    keywords: ["if","else","for","while","do","switch","case","break","continue","return","struct","union","enum","typedef","sizeof","static","extern","auto","register","const","volatile","void","int","long","double","float","char","unsigned","signed","short","goto","inline"],
    operators: ["+","-","*","/","%","=","==","!=","<",">","<=",">=","&&","||","!","&","|","^","~","<<",">>","++","--","+=","-=","*=","/=","%=","->",".","?",":"],
    commentSingle: "//",
  },
  cpp: {
    label: "C++", ext: ".cpp", color: "#ec4899", mime: "text/x-c++src",
    keywords: ["if","else","for","while","do","switch","case","break","continue","return","class","struct","namespace","template","typename","using","new","delete","this","virtual","override","final","public","private","protected","static","const","constexpr","auto","nullptr","true","false","try","catch","throw","operator","friend","inline","explicit","mutable","volatile","extern","typedef","enum","union","sizeof"],
    operators: ["+","-","*","/","%","=","==","!=","<",">","<=",">=","&&","||","!","&","|","^","~","<<",">>","++","--","+=","-=","*=","/=","%=","->",".*","->*","::","?",":"],
    commentSingle: "//",
  },
};

function stripComments(code, lang) {
  let r = code;
  if (lang === "python") {
    r = r.replace(/"""[\s\S]*?"""/g, "").replace(/'''[\s\S]*?'''/g, "").replace(/#[^\n]*/g, "");
  } else {
    r = r.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  }
  return r;
}

function countCommentLines(code, lang) {
  const lines = code.split("\n"); let count = 0, inBlock = false;
  for (const raw of lines) {
    const t = raw.trim();
    if (!inBlock) {
      if (lang === "python") { if (t.startsWith("#") || t.startsWith('"""') || t.startsWith("'''")) count++; }
      else { if (t.startsWith("/*")) { inBlock = !t.includes("*/"); count++; } else if (t.startsWith("//")) count++; }
    } else { count++; if (t.includes("*/")) inBlock = false; }
  }
  return count;
}

function halstead(code, lang) {
  const cfg = LANGS[lang];
  const clean = stripComments(code, lang).replace(/["'`][^"'`\n]*["'`]/g, "STR");
  const kwSet = new Set(cfg.keywords);
  const sortedOps = [...cfg.operators].sort((a, b) => b.length - a.length);
  const opPat = sortedOps.map(o => o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const symOps = clean.match(new RegExp(opPat, "g")) || [];
  const kwPat = `\\b(${cfg.keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`;
  const kwOps = clean.match(new RegExp(kwPat, "g")) || [];
  const allOps = [...symOps, ...kwOps];
  const identRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  const allIdents = []; let m;
  while ((m = identRegex.exec(clean)) !== null) { if (!kwSet.has(m[1])) allIdents.push(m[1]); }
  const n1 = new Set(allOps).size, n2 = new Set(allIdents).size;
  const N1 = allOps.length, N2 = allIdents.length;
  const vocab = n1 + n2, length = N1 + N2;
  const volume = length > 0 && vocab > 1 ? length * Math.log2(vocab) : 0;
  const difficulty = n2 > 0 ? (n1 / 2) * (N2 / n2) : 0;
  const effort = difficulty * volume;
  return { n1, n2, N1, N2, vocab, length, volume: Math.round(volume), difficulty: +difficulty.toFixed(2), effort: Math.round(effort), time: +(effort / 18).toFixed(1), bugs: +(volume / 3000).toFixed(3) };
}

function cyclomaticCC(code, lang) {
  const pats = { python: /\b(if|elif|else|for|while|except|and|or|with|case)\b/g, java: /\b(if|else|for|while|do|case|catch)\b|&&|\|\|/g, c: /\b(if|else|for|while|do|case)\b|&&|\|\|/g, cpp: /\b(if|else|for|while|do|case|catch)\b|&&|\|\|/g };
  return Math.min(1 + (stripComments(code, lang).match(pats[lang] || pats.c) || []).length, 150);
}

function countLOC(code) {
  const lines = code.split("\n");
  return { total: lines.length, blank: lines.filter(l => !l.trim()).length, code: lines.filter(l => l.trim()).length };
}

function miScore(volume, cc, loc) {
  if (loc === 0) return 0;
  const raw = 171 - 5.2 * Math.log(Math.max(volume, 1)) - 0.23 * cc - 16.2 * Math.log(loc);
  return Math.max(0, Math.min(100, Math.round(raw * 100 / 171)));
}

function runAnalysis(code, lang) {
  const h = halstead(code, lang), cc = cyclomaticCC(code, lang), loc = countLOC(code);
  const commentLines = countCommentLines(code, lang), mi = miScore(h.volume, cc, loc.code);
  const commentRatio = loc.total > 0 ? commentLines / loc.total : 0;
  const avgLL = +(code.split("\n").reduce((s, l) => s + l.length, 0) / Math.max(loc.total, 1)).toFixed(1);
  const fnPat = { python: /def\s+\w+/g, java: /\w[\w\s<>[\]]*\w\s*\([^)]*\)\s*\{/g, c: /\w+\s+\w+\s*\([^)]*\)\s*\{/g, cpp: /\w+\s+[\w:<>*&]+\s*\([^)]*\)\s*[\{:]/g };
  const fns = Math.max(1, (code.match(fnPat[lang] || fnPat.c) || []).length);
  return { h, cc, loc, commentLines, mi, commentRatio, avgLL, fns, avgCC: +(cc / fns).toFixed(1) };
}

function grade(mi) {
  if (mi >= 85) return { label: "A+", color: "var(--green)", text: "Excellent" };
  if (mi >= 75) return { label: "A", color: "var(--green)", text: "Very Good" };
  if (mi >= 65) return { label: "B", color: "var(--accent)", text: "Good" };
  if (mi >= 50) return { label: "C", color: "var(--amber)", text: "Fair" };
  if (mi >= 35) return { label: "D", color: "#f97316", text: "Poor" };
  return { label: "F", color: "var(--red)", text: "Critical" };
}

function ccLabel(cc) {
  if (cc <= 5) return { text: "Simple", color: "var(--green)" };
  if (cc <= 10) return { text: "Moderate", color: "var(--accent)" };
  if (cc <= 20) return { text: "Complex", color: "var(--amber)" };
  if (cc <= 50) return { text: "Very Complex", color: "#f97316" };
  return { text: "Unmaintainable", color: "var(--red)" };
}

function getInsights(r) {
  const items = [], { mi, cc, h, commentRatio, avgCC } = r;
  if (mi >= 75) items.push({ t: "success", m: `MI is strong (${mi}/100). The codebase is clean and well-structured.` });
  else if (mi >= 50) items.push({ t: "warn", m: `MI is moderate (${mi}/100). Consider refactoring complex sections.` });
  else items.push({ t: "error", m: `MI is low (${mi}/100). Significant refactoring is strongly recommended.` });
  if (cc > 20) items.push({ t: "error", m: `Cyclomatic Complexity is very high (${cc}). Break functions into smaller units. Target CC ≤ 10.` });
  else if (cc > 10) items.push({ t: "warn", m: `Cyclomatic Complexity is elevated (${cc}). Avg per function: ${avgCC}. Aim for CC ≤ 10.` });
  else items.push({ t: "success", m: `Cyclomatic Complexity is within acceptable range (${cc}). Logic flow is easy to follow.` });
  if (h.volume > 10000) items.push({ t: "error", m: `Halstead Volume is very high (${h.volume.toLocaleString()}). Split into smaller modules.` });
  else if (h.volume > 4000) items.push({ t: "warn", m: `Halstead Volume is moderate-high (${h.volume.toLocaleString()}). Monitor growing complexity.` });
  else items.push({ t: "success", m: `Halstead Volume is healthy (${h.volume.toLocaleString()}). Code density is manageable.` });
  const cr = Math.round(commentRatio * 100);
  if (cr < 5) items.push({ t: "warn", m: `Comment density is very low (${cr}%). Add documentation for functions and complex logic.` });
  else if (cr > 45) items.push({ t: "info", m: `Comment density is high (${cr}%). Ensure comments are meaningful and current.` });
  else items.push({ t: "success", m: `Comment density is healthy (${cr}%). Good documentation coverage.` });
  if (h.difficulty > 60) items.push({ t: "error", m: `Halstead Difficulty is very high (${h.difficulty}). Simplify operator/variable usage.` });
  else if (h.difficulty > 30) items.push({ t: "warn", m: `Halstead Difficulty is moderate (${h.difficulty}). Some sections may be hard to understand.` });
  if (h.bugs > 1) items.push({ t: "warn", m: `Estimated defects: ${h.bugs}. High complexity often correlates with bugs.` });
  const tStr = h.time > 3600 ? (h.time / 3600).toFixed(1) + " hrs" : h.time > 60 ? (h.time / 60).toFixed(1) + " min" : h.time + " sec";
  items.push({ t: "info", m: `Estimated coding time: ${tStr}. Halstead effort: ${h.effort.toLocaleString()} mental discriminations.` });
  return items;
}

function GaugeRing({ value, color, size = 130 }) {
  const r = 52, circ = 2 * Math.PI * r, offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} viewBox="0 0 130 130">
      <circle cx="65" cy="65" r={r} fill="none" stroke="var(--muted)" strokeWidth="10" />
      <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 65 65)" style={{ transition: "stroke-dashoffset 1s ease" }} />
      <text x="65" y="62" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--text)" fontFamily="JetBrains Mono,monospace">{value}</text>
      <text x="65" y="78" textAnchor="middle" fontSize="11" fill="var(--textSub)" fontFamily="Syne,sans-serif">/ 100</text>
    </svg>
  );
}

function RadarChart({ scores }) {
  const cx = 110, cy = 110, r = 80;
  const axes = [
    { label: "MI Score", val: scores.mi / 100 }, { label: "Readability", val: scores.readability },
    { label: "Simplicity", val: scores.simplicity }, { label: "Comments", val: scores.comments },
    { label: "Efficiency", val: scores.efficiency },
  ];
  const n = axes.length;
  const pt = (scale, i) => { const a = (2 * Math.PI * i) / n - Math.PI / 2; return [cx + r * scale * Math.cos(a), cy + r * scale * Math.sin(a)]; };
  const dataPoints = axes.map((a, i) => pt(a.val, i));
  return (
    <svg viewBox="0 0 220 220" style={{ width: "100%", maxWidth: 200 }}>
      {[0.25, 0.5, 0.75, 1].map((lv, gi) => { const gpts = axes.map((_, i) => pt(lv, i)); return <polygon key={gi} points={gpts.map(p => p.join(",")).join(" ")} fill="none" stroke="var(--border)" strokeWidth="0.8" />; })}
      {axes.map((_, i) => { const [ex, ey] = pt(1, i); return <line key={i} x1={cx} y1={cy} x2={ex} y2={ey} stroke="var(--border)" strokeWidth="0.8" />; })}
      <polygon points={dataPoints.map(p => p.join(",")).join(" ")} fill="rgba(79, 156, 249, 0.16)" stroke="var(--accent)" strokeWidth="1.5" />
      {dataPoints.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="var(--accent)" />)}
      {axes.map((a, i) => { const [lx, ly] = pt(1.3, i); return <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="var(--textSub)" fontFamily="Syne">{a.label}</text>; })}
    </svg>
  );
}

function MetricBar({ label, value, max, color }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="metric-bar">
      <div className="metric-bar-header">
        <span className="metric-bar-label">{label}</span>
        <span className="metric-bar-value">{typeof value === "number" && value > 999 ? value.toLocaleString() : value}</span>
      </div>
      <div className="metric-bar-track">
        <div className="metric-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function MCard({ label, value, sub, color }) {
  return (
    <div className="metric-card">
      <div className="metric-card-label">{label}</div>
      <div className="metric-card-value" style={{ color: color || "var(--text)" }}>{typeof value === "number" && value > 9999 ? value.toLocaleString() : value}</div>
      {sub && <div className="metric-card-sub">{sub}</div>}
    </div>
  );
}

function InsightItem({ t, m }) {
  const icons = { success: "✓", warn: "!", error: "✕", info: "i" };
  return (
    <div className={`insight-item insight-${t}`}>
      <div className="insight-icon">{icons[t]}</div>
      <span className="insight-text">{m}</span>
    </div>
  );
}

function Tag({ color, children }) { 
  return <span className="tag" style={{ background: color + "22", color, borderColor: color + "44" }}>{children}</span>; 
}

function Btn({ onClick, children, secondary }) {
  return <button onClick={onClick} className={`btn ${secondary ? 'btn-secondary' : 'btn-primary'}`}>{children}</button>;
}

export default function App() {
  const [lang, setLang] = useState("python");
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState("editor");
  const [history, setHistory] = useState([]);
  const [label, setLabel] = useState("my_analysis");
  const [animKey, setAnimKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [fileName, setFileName] = useState("");
  const [isDark, setIsDark] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(prefersDark);
    document.body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    document.body.setAttribute('data-theme', newTheme ? 'dark' : 'light');
  };

  const handleLanguageChange = (newLang) => {
    setLang(newLang);
    setCode("");
    setFileName("");
    setResult(null);
  };

  const loadSampleCode = useCallback(async () => {
    try {
      const ext = lang === "cpp" ? "cpp" : lang;
      const response = await fetch(`/samples/sample.${ext}`);
      if (response.ok) {
        const sampleCode = await response.text();
        setCode(sampleCode);
        setFileName(`sample.${ext}`);
        setResult(null);
      }
    } catch (error) {
      console.error("Error loading sample:", error);
    }
  }, [lang]);

  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const extension = "." + file.name.split(".").pop().toLowerCase();
    let detectedLang = null;
    
    for (const [key, config] of Object.entries(LANGS)) {
      if (config.ext === extension) {
        detectedLang = key;
        break;
      }
    }
    
    if (detectedLang) {
      setLang(detectedLang);
    }
    
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setCode(e.target.result);
      setResult(null);
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const triggerFileUpload = () => {
    fileInputRef.current.click();
  };

  const handleAnalyze = useCallback(() => {
    if (!code.trim()) return;
    const r = runAnalysis(code, lang);
    setResult(r); setAnimKey(k => k + 1); setTab("results");
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setHistory(h => [{ id: Date.now(), label: label || "analysis", lang, mi: r.mi, loc: r.loc.code, ts, code, r }, ...h.slice(0, 19)]);
  }, [code, lang, label]);

  const loadHistory = (item) => { setLang(item.lang); setCode(item.code); setResult(item.r); setLabel(item.label); setTab("results"); };

  const g = result ? grade(result.mi) : null;
  const ccL = result ? ccLabel(result.cc) : null;
  const radarScores = result ? { mi: result.mi, readability: Math.max(0, Math.min(1, 1 - result.h.difficulty / 100)), simplicity: Math.max(0, Math.min(1, 1 - result.cc / 50)), comments: Math.min(1, result.commentRatio * 4), efficiency: Math.max(0, Math.min(1, 1 - result.h.volume / 15000)) } : null;

  return (
    <div className="app">
      <div className="header">
        <div className="logo">
          <svg width="22" height="22" viewBox="0 0 22 22">
            <circle cx="11" cy="11" r="10" fill="none" stroke="var(--accent)" strokeWidth="2" />
            <path d="M7 11 L11 7 L15 11 L11 15 Z" fill="var(--accent)" opacity="0.6" />
            <circle cx="11" cy="11" r="2.5" fill="var(--accent)" />
          </svg>
          <span className="logo-text">CodeMetrics</span>
          <span className="logo-sub">MI Analyzer</span>
        </div>
        
        <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          ☰
        </button>
        
        <div className={`nav-tabs ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          {[["editor", "✏ Editor"], ["results", "📊 Results"], ["history", "🕑 History"], ["about", "ℹ About"]].map(([k, v]) => (
            <button key={k} onClick={() => { setTab(k); setMobileMenuOpen(false); }} className={`nav-btn ${tab === k ? 'active' : ''}`}>{v}</button>
          ))}
          <button onClick={toggleTheme} className="theme-toggle">
            {isDark ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="content-area">
          {tab === "editor" && (
            <div>
              <div className="lang-bar">
                {Object.entries(LANGS).map(([k, v]) => (
                  <button key={k} onClick={() => handleLanguageChange(k)} className={`lang-btn ${lang === k ? 'active' : ''}`} style={{ borderColor: lang === k ? v.color : "var(--border)", background: lang === k ? v.color + "22" : "transparent", color: lang === k ? v.color : "var(--textSub)" }}>{v.label}</button>
                ))}
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".py,.java,.c,.cpp" className="file-input-hidden" />
                <button onClick={triggerFileUpload} className="action-secondary-btn">📁 Load File</button>
                <button onClick={loadSampleCode} className="action-secondary-btn">📋 Load Sample</button>
                {fileName && <span className="file-name">📄 {fileName}</span>}
              </div>
              <div className="editor-container">
                <div className="editor-header">
                  <div className="window-dots">
                    <div className="window-dot red"></div>
                    <div className="window-dot yellow"></div>
                    <div className="window-dot green"></div>
                  </div>
                  <span className="editor-filename">{label || "untitled"}{LANGS[lang].ext}</span>
                  <span className="editor-stats">{code.split("\n").length} lines · {code.length} chars</span>
                </div>
                <div className="editor-body">
                  <div className="line-numbers">
                    {code.split("\n").map((_, i) => <div key={i}>{i + 1}</div>)}
                  </div>
                  <textarea 
                    value={code} 
                    onChange={e => setCode(e.target.value)} 
                    spellCheck={false} 
                    placeholder="// Write your code here or load a file using the buttons above" 
                    className="code-editor" 
                  />
                </div>
              </div>
              <div className="action-buttons">
                <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Analysis label..." className="label-input" />
                <Btn onClick={handleAnalyze}>Analyze Code ↗</Btn>
                <Btn secondary onClick={() => { setCode(""); setFileName(""); setResult(null); }}>Clear</Btn>
              </div>
            </div>
          )}

          {tab === "results" && !result && (
            <div className="empty-state">
              <div className="empty-icon">⌀</div>
              <div className="empty-title">No analysis yet.</div>
              <div className="empty-sub">Go to the Editor tab and click Analyze Code.</div>
              <div className="empty-action"><Btn onClick={() => setTab("editor")}>Go to Editor</Btn></div>
            </div>
          )}

          {tab === "results" && result && (
            <div key={animKey}>
              <div className="result-header">
                <GaugeRing value={result.mi} color={g.color} />
                <div className="result-info">
                  <div className="result-label">Maintainability Index</div>
                  <div className="result-score">
                    <span className="score-value" style={{ color: g.color }}>{result.mi}</span>
                    <Tag color={g.color}>{g.label} — {g.text}</Tag>
                  </div>
                  <div className="result-meta">{LANGS[lang].label} · {result.loc.code} code lines · {result.fns} function{result.fns !== 1 ? "s" : ""}</div>
                  <div className="result-tags">
                    <Tag color={ccL.color}>CC {result.cc} — {ccL.text}</Tag>
                    <Tag color="var(--purple)">Vol {result.h.volume.toLocaleString()}</Tag>
                    <Tag color="var(--accent)">Effort {result.h.effort.toLocaleString()}</Tag>
                  </div>
                </div>
                <div className="radar-wrapper"><RadarChart scores={radarScores} /></div>
              </div>

              <div className="section-label">Key Metrics</div>
              <div className="metrics-grid">
                <MCard label="MI Score" value={result.mi} sub="0–100" color={g.color} />
                <MCard label="Cyclomatic CC" value={result.cc} sub={ccL.text} color={ccL.color} />
                <MCard label="LOC (code)" value={result.loc.code} sub={`${result.loc.total} total`} />
                <MCard label="Comment Lines" value={result.commentLines} sub={`${Math.round(result.commentRatio * 100)}% ratio`} color="var(--purple)" />
                <MCard label="Functions" value={result.fns} sub={`Avg CC ${result.avgCC}`} />
                <MCard label="Avg Line Len" value={result.avgLL} sub="chars" />
                <MCard label="Halstead Vol" value={result.h.volume} sub="V=N·log₂η" color="var(--accent)" />
                <MCard label="Est. Bugs" value={result.h.bugs} sub="B=V/3000" color={result.h.bugs > 1 ? "var(--amber)" : "var(--textSub)"} />
              </div>

              <div className="two-columns">
                <div className="metrics-panel">
                  <div className="panel-title">Halstead Metrics</div>
                  <MetricBar label="Distinct Operators η₁" value={result.h.n1} max={80} color="var(--accent)" />
                  <MetricBar label="Distinct Operands η₂" value={result.h.n2} max={150} color="var(--purple)" />
                  <MetricBar label="Total Operators N₁" value={result.h.N1} max={500} color="var(--accent)" />
                  <MetricBar label="Total Operands N₂" value={result.h.N2} max={800} color="var(--purple)" />
                  <MetricBar label="Vocabulary η" value={result.h.vocab} max={200} color="var(--green)" />
                  <MetricBar label="Length N" value={result.h.length} max={1000} color="var(--green)" />
                  <MetricBar label="Difficulty D" value={result.h.difficulty} max={100} color="var(--amber)" />
                  <MetricBar label="Volume V" value={result.h.volume} max={15000} color="var(--accent)" />
                  <MetricBar label="Effort E" value={result.h.effort} max={500000} color="var(--red)" />
                  <MetricBar label="Time (sec)" value={result.h.time} max={10000} color="var(--textSub)" />
                </div>
                <div className="insights-panel">
                  <div className="panel-title">Analysis Insights</div>
                  {getInsights(result).map((item, i) => <InsightItem key={i} t={item.t} m={item.m} />)}
                  <div className="mi-breakdown">
                    <div className="panel-subtitle">MI Formula Breakdown</div>
                    <div className="formula-box">
                      <div className="formula">MI = 171 − 5.2·ln(V) − 0.23·G − 16.2·ln(LOC)</div>
                      <div>    = 171 − 5.2·ln(<span className="formula-value" style={{ color: "var(--purple)" }}>{result.h.volume}</span>)</div>
                      <div>        − 0.23·<span className="formula-value" style={{ color: "var(--amber)" }}>{result.cc}</span></div>
                      <div>        − 16.2·ln(<span className="formula-value" style={{ color: "var(--green)" }}>{result.loc.code}</span>)</div>
                      <div>    = <span className="formula-result" style={{ color: g.color }}>{result.mi}</span> / 100</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="action-buttons">
                <Btn secondary onClick={() => setTab("editor")}>← Edit Code</Btn>
                <Btn onClick={() => {
                  const txt = `MI Analysis Report\n${"─".repeat(40)}\nLanguage: ${LANGS[lang].label}\nMI Score: ${result.mi} (${g.label} — ${g.text})\nCyclomatic Complexity: ${result.cc} (${ccL.text})\nLines of Code: ${result.loc.code}\nHalstead Volume: ${result.h.volume}\nDifficulty: ${result.h.difficulty}\nEffort: ${result.h.effort}\nEstimated Bugs: ${result.h.bugs}\n\nInsights:\n${getInsights(result).map(i => "• " + i.m).join("\n")}`;
                  navigator.clipboard.writeText(txt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
                }}>{copied ? "✓ Copied!" : "Copy Report"}</Btn>
              </div>
            </div>
          )}

          {tab === "history" && (
            <div>
              <div className="history-header">{history.length === 0 ? "No analyses yet. Run some code to see history here." : `${history.length} saved analys${history.length !== 1 ? "es" : "is"}`}</div>
              {history.length > 0 && (
                <div className="history-list">
                  <div className="history-list-header">
                    <div></div><div>Label / Language</div><div>MI</div>
                  </div>
                  {history.map(h => {
                    const hg = grade(h.mi);
                    return (
                      <div key={h.id} onClick={() => loadHistory(h)} className="history-item">
                        <div className="history-dot" style={{ background: LANGS[h.lang].color }}></div>
                        <div className="history-info">
                          <div className="history-label">{h.label}</div>
                          <div className="history-meta">{h.ts} · {LANGS[h.lang].label} · {h.loc} LOC</div>
                        </div>
                        <div className="history-mi" style={{ color: hg.color }}>{h.mi}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {history.length > 1 && (
                <div>
                  <div className="section-label">Score Distribution</div>
                  <div className="distribution-chart">
                    {history.slice(0, 20).reverse().map((h, i) => { const hg = grade(h.mi); return <div key={i} title={`${h.label}: ${h.mi}`} onClick={() => loadHistory(h)} className="distribution-bar" style={{ background: hg.color + "44", height: `${h.mi}%`, borderColor: hg.color }} />; })}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "about" && (
            <div className="about-container">
              <div className="about-title">About CodeMetrics</div>
              <div className="about-subtitle">A full-featured Maintainability Index analyzer for Python, Java, C, and C++.</div>
              
              <div className="info-card">
                <div className="info-card-title">📚 Course Information</div>
                <div className="info-card-body">
                  <strong>Course:</strong> Software Engineering<br />
                  <strong>Instructor:</strong> Sir Fida Husain Khoso<br />
                  <strong>University:</strong> Dawood University of Engineering and Technology
                </div>
              </div>

              <div className="info-card">
                <div className="info-card-title">👥 Group Members</div>
                <div className="info-card-body">
                  <div>• <strong>Mubashir Awan</strong> — Roll No: 24F-CS-074</div>
                  <div>• <strong>Fahad Ullah</strong> — Roll No: 24F-CS-073</div>
                  <div>• <strong>Omamah Munawar</strong> — Roll No: 24F-CS-079</div>
                </div>
              </div>

              <div className="info-card">
                <div className="info-card-title">Maintainability Index (MI)</div>
                <div className="info-card-body">The MI is a composite metric developed by Oman & Hagemeister (1992). It combines Halstead Volume, Cyclomatic Complexity, and Lines of Code into a 0–100 score. Scores ≥ 85 are excellent; below 35 indicates critical technical debt.</div>
              </div>

              <div className="info-card">
                <div className="info-card-title">Cyclomatic Complexity (CC)</div>
                <div className="info-card-body">Introduced by McCabe (1976), CC counts linearly independent paths through code. It equals 1 + the number of decision points (if/else/for/while/case). CC ≤ 10 is recommended per function.</div>
              </div>

              <div className="info-card">
                <div className="info-card-title">Halstead Metrics</div>
                <div className="info-card-body">Halstead (1977) defined metrics based on operators and operands: η₁ (distinct operators), η₂ (distinct operands). Derived: Volume V = N·log₂η, Difficulty D = (η₁/2)·(N₂/η₂), Effort E = D·V, Bugs B = V/3000.</div>
              </div>

              <div className="info-card">
                <div className="info-card-title">MI Formula</div>
                <div className="info-card-body">MI = 171 − 5.2·ln(V) − 0.23·CC − 16.2·ln(LOC), normalized to 0–100. Higher is better.</div>
              </div>
              
              <div className="grade-card">
                <div className="grade-card-title">Grade Scale</div>
                {[["A+", "85–100", "var(--green)", "Excellent"], ["A", "75–84", "var(--green)", "Very Good"], ["B", "65–74", "var(--accent)", "Good — minor improvements needed"], ["C", "50–64", "var(--amber)", "Fair — refactoring recommended"], ["D", "35–49", "#f97316", "Poor — significant technical debt"], ["F", "0–34", "var(--red)", "Critical — major refactoring required"]].map(([g, range, c, desc]) => (
                  <div key={g} className="grade-item">
                    <Tag color={c}>{g}</Tag>
                    <span className="grade-range">{range}</span>
                    <span className="grade-desc">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}