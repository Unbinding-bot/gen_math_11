import { useState, useMemo, useEffect } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line
} from "recharts";

const PESO = (n) => "₱" + Math.round(n).toLocaleString("en-PH");
const PCT = (n) => (n * 100).toFixed(1) + "%";

// ─── Responsive hook ───────────────────────────────────────────────────────────
function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const handler = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return size;
}

// ─── Breakpoints ───────────────────────────────────────────────────────────────
// phone  < 640
// tablet  640–1024
// desktop 1024–1600
// tv     ≥ 1600
function getBreakpoint(w) {
  if (w < 640)  return "phone";
  if (w < 1024) return "tablet";
  if (w < 1600) return "desktop";
  return "tv";
}

// Scale factor used for spacing / font sizes
const SCALE = { phone: 1, tablet: 1.15, desktop: 1.3, tv: 1.9 };

// ─── Gov't formulas ───────────────────────────────────────────────────────────
function computeSSS(basic) {
  const msc = Math.min(Math.max(Math.round(basic / 500) * 500, 4000), 30000);
  return Math.round(msc * 0.05);
}
function computePhilHealth(basic) {
  const base = Math.min(Math.max(basic, 10000), 100000);
  return Math.round((base * 0.05) / 2);
}
function computePagIbig(basic) {
  return Math.min(Math.round(basic * 0.02), 200);
}
function computeWithholdingTax(monthlyTaxable) {
  const annual = monthlyTaxable * 12;
  let annualTax = 0;
  if (annual <= 250000) annualTax = 0;
  else if (annual <= 400000) annualTax = (annual - 250000) * 0.15;
  else if (annual <= 800000) annualTax = 22500 + (annual - 400000) * 0.20;
  else if (annual <= 2000000) annualTax = 102500 + (annual - 800000) * 0.25;
  else if (annual <= 8000000) annualTax = 402500 + (annual - 2000000) * 0.30;
  else annualTax = 2202500 + (annual - 8000000) * 0.35;
  return Math.round(annualTax / 12);
}
function getTaxNote(annualTaxable) {
  if (annualTaxable <= 250000) return { label: "Tax-free zone", color: "#22c55e", note: "Under ₱250K/yr — TRAIN Law exempts you completely. Zero income tax." };
  if (annualTaxable <= 400000) return { label: "15% bracket",   color: "#f59e0b", note: "₱250K–₱400K — 15% on the excess over ₱250K only." };
  if (annualTaxable <= 800000) return { label: "20% bracket",   color: "#f97316", note: "₱400K–₱800K — ₱22,500 fixed + 20% on excess over ₱400K." };
  return                              { label: "25%+ bracket",  color: "#ef4444", note: "Above ₱800K — progressive rates under TRAIN Law (RA 10963)." };
}

const CHART_COLORS = {
  gross: "#6366f1", sss: "#f59e0b", philhealth: "#22c55e",
  pagibig: "#06b6d4", tax: "#ef4444", net: "#10b981",
};

// ─── Reusable components ──────────────────────────────────────────────────────
const Slider = ({ label, min, max, step, value, onChange, format, color, s }) => (
  <div style={{ marginBottom: s(20) }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: s(6) }}>
      <span style={{ fontSize: s(13), color: "#94a3b8", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: s(15), fontWeight: 700, color: color || "#f1f5f9" }}>{format(value)}</span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: "100%", accentColor: color || "#6366f1", height: s(4), cursor: "pointer" }}
    />
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: s(11), color: "#475569", marginTop: s(3) }}>
      <span>{format(min)}</span><span>{format(max)}</span>
    </div>
  </div>
);

const StatCard = ({ label, value, sub, color, s }) => (
  <div style={{
    background: "rgba(255,255,255,0.05)", borderRadius: s(12),
    border: `1px solid ${color}33`, padding: `${s(14)}px ${s(16)}px`,
    borderLeft: `${s(3)}px solid ${color}`
  }}>
    <div style={{ fontSize: s(10), color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: s(4) }}>{label}</div>
    <div style={{ fontSize: s(20), fontWeight: 800, color, fontFamily: "'Space Grotesk', sans-serif" }}>{value}</div>
    {sub && <div style={{ fontSize: s(11), color: "#64748b", marginTop: s(3) }}>{sub}</div>}
  </div>
);

const LawTag = ({ children, color, s }) => (
  <span style={{
    background: color + "22", color, border: `1px solid ${color}55`,
    borderRadius: s(6), padding: `${s(2)}px ${s(8)}px`,
    fontSize: s(11), fontWeight: 600, marginLeft: s(6)
  }}>{children}</span>
);

const TipBox = ({ note, s }) => (
  <div style={{
    background: "#1e293b", border: "1px solid #334155", borderRadius: s(8),
    padding: `${s(10)}px ${s(14)}px`, fontSize: s(12), color: "#94a3b8",
    marginTop: s(4), lineHeight: 1.6, maxWidth: 400
  }}>💡 {note}</div>
);

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const { w } = useWindowSize();
  const bp = getBreakpoint(w);
  const sc = SCALE[bp];

  // s(n) scales a base pixel value
  const s = (n) => Math.round(n * sc);

  const isPhone   = bp === "phone";
  const isTV      = bp === "tv";
  const isMobile  = bp === "phone" || bp === "tablet";

  const [salary, setSalary]     = useState(18000);
  const [regularOT, setRegularOT] = useState(8);
  const [nightOT, setNightOT]   = useState(4);
  const [nsdHours, setNsdHours] = useState(6);
  const [children, setChildren] = useState(1);
  const [bonus, setBonus]       = useState(0);
  const [showTip, setShowTip]   = useState(null);
  const [mobileTab, setMobileTab] = useState("inputs"); // phone tab: inputs | charts

  const calc = useMemo(() => {
    const dailyRate  = (salary * 12) / 313;
    const hourlyRate = dailyRate / 8;
    const regOTPay   = hourlyRate * 1.25 * regularOT;
    const nsdPay     = hourlyRate * 0.10 * nsdHours;
    const nightOTPay = hourlyRate * 1.375 * nightOT;
    const grossIncome = salary + regOTPay + nsdPay + nightOTPay + bonus;

    const sss          = computeSSS(salary);
    const philhealth   = computePhilHealth(salary);
    const pagibig      = computePagIbig(salary);
    const totalDeductions = sss + philhealth + pagibig;
    const taxableMonthly  = grossIncome - totalDeductions;
    const withholdingTax  = computeWithholdingTax(taxableMonthly);
    const netPay          = grossIncome - totalDeductions - withholdingTax;
    const annualTaxable   = taxableMonthly * 12;
    const taxNote         = getTaxNote(annualTaxable);

    const food       = 4500 + children * 1750;
    const rent       = 4000 + (children > 2 ? 1000 : 0);
    const utilities  = 1500 + children * 150;
    const transpo    = 1200;
    const education  = children * 1500;
    const savings    = 1500;
    const totalExpenses = food + rent + utilities + transpo + education + savings;
    const surplus    = netPay - totalExpenses;

    return {
      dailyRate, hourlyRate, regOTPay, nsdPay, nightOTPay, grossIncome,
      sss, philhealth, pagibig, totalDeductions,
      withholdingTax, netPay, annualTaxable, taxNote,
      food, rent, utilities, transpo, education, savings, totalExpenses, surplus
    };
  }, [salary, regularOT, nightOT, nsdHours, children, bonus]);

  const pieData = [
    { name: "SSS",         value: calc.sss,            color: CHART_COLORS.sss       },
    { name: "PhilHealth",  value: calc.philhealth,     color: CHART_COLORS.philhealth },
    { name: "Pag-IBIG",   value: calc.pagibig,        color: CHART_COLORS.pagibig   },
    { name: "Income Tax",  value: calc.withholdingTax, color: CHART_COLORS.tax       },
    { name: "Take-Home",   value: calc.netPay,         color: CHART_COLORS.net       },
  ].filter(d => d.value > 0);

  const barData = [
    { label: "Basic",      amount: salary },
    { label: "Regular OT", amount: Math.round(calc.regOTPay)   },
    { label: "NSD",        amount: Math.round(calc.nsdPay)     },
    { label: "Night OT",   amount: Math.round(calc.nightOTPay) },
    { label: "Bonus",      amount: bonus },
  ].filter(d => d.amount > 0);

  const budgetData = [
    { name: "Food",      amount: calc.food,      color: "#f59e0b" },
    { name: "Rent",      amount: calc.rent,      color: "#6366f1" },
    { name: "Utilities", amount: calc.utilities, color: "#22c55e" },
    { name: "Transpo",   amount: calc.transpo,   color: "#06b6d4" },
    { name: "Education", amount: calc.education, color: "#ec4899" },
    { name: "Savings",   amount: calc.savings,   color: "#8b5cf6" },
  ];

  const salaryRange = Array.from({ length: 11 }, (_, i) => {
    const sv = 15000 + i * 1500;
    const ss = computeSSS(sv), ph = computePhilHealth(sv), pi = computePagIbig(sv);
    const td = ss + ph + pi;
    const tax = computeWithholdingTax(sv - td);
    return { salary: sv / 1000 + "K", gross: sv, net: sv - td - tax };
  });

  const CustomTooltipPie = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: s(8), padding: `${s(8)}px ${s(14)}px`, fontSize: s(13) }}>
        <div style={{ color: d.payload.color, fontWeight: 700 }}>{d.name}</div>
        <div style={{ color: "#f1f5f9" }}>{PESO(d.value)}</div>
        <div style={{ color: "#64748b" }}>{PCT(d.value / calc.grossIncome)}</div>
      </div>
    );
  };

  // ── Layout values derived from breakpoint ──────────────────────────────────
  const leftColWidth = isPhone ? "100%" : isTV ? 420 : bp === "tablet" ? 280 : 320;
  const mainPadH     = s(isPhone ? 14 : 24);
  const cardRadius   = s(16);
  const cardPad      = s(20);
  const chartH       = s(isPhone ? 180 : 200);
  const heroFontSize = isPhone ? s(44) : isTV ? s(64) : s(56);
  const statCols     = isPhone ? "1fr 1fr" : isTV ? "repeat(4, 1fr)" : "repeat(2, 1fr)";
  const dualColGrid  = isPhone ? "1fr" : "1fr 1fr";
  const budgetDetailCols = isPhone ? "1fr" : "1fr 1fr";

  // ── Controls panel (shared between sidebar and mobile tab) ────────────────
  const ControlsPanel = () => (
    <div style={{
      background: "rgba(255,255,255,0.04)", borderRadius: cardRadius,
      border: "1px solid rgba(255,255,255,0.08)", padding: `${cardPad}px`,
      ...(isPhone ? {} : { position: "sticky", top: s(20), height: "fit-content" })
    }}>
      <div style={{ fontSize: s(12), fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: s(20) }}>
        Adjust Your Numbers
      </div>

      <Slider s={s} label="Monthly Basic Salary" min={15000} max={30000} step={500}
        value={salary} onChange={setSalary} format={PESO} color="#f5a623" />

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", margin: `${s(16)}px 0` }} />
      <div style={{ fontSize: s(11), color: "#475569", marginBottom: s(12), textTransform: "uppercase", letterSpacing: 1 }}>Overtime</div>

      <Slider s={s} label="Regular Overtime Hours" min={0} max={80} step={1}
        value={regularOT} onChange={setRegularOT} format={v => v + " hrs"} color="#8b5cf6" />
      <Slider s={s} label="Night Shift Diff. Hours (10PM–6AM)" min={0} max={80} step={1}
        value={nsdHours} onChange={setNsdHours} format={v => v + " hrs"} color="#ec4899" />
      <Slider s={s} label="Night Shift Overtime Hours" min={0} max={40} step={1}
        value={nightOT} onChange={setNightOT} format={v => v + " hrs"} color="#06b6d4" />

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", margin: `${s(16)}px 0` }} />
      <div style={{ fontSize: s(11), color: "#475569", marginBottom: s(12), textTransform: "uppercase", letterSpacing: 1 }}>Family</div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: s(20) }}>
        <span style={{ fontSize: s(13), color: "#94a3b8", fontWeight: 500 }}>Number of Children</span>
        <div style={{ display: "flex", alignItems: "center", gap: s(12) }}>
          {[["−", () => setChildren(Math.max(0, children - 1))], ["+", () => setChildren(Math.min(5, children + 1))]].map(([lbl, fn], i) => (
            <button key={i} onClick={fn} style={{
              width: s(36), height: s(36), borderRadius: s(8),
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
              color: "#f1f5f9", fontSize: s(20), cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>{lbl}</button>
          ))}
          <span style={{ fontSize: s(24), fontWeight: 800, minWidth: s(28), textAlign: "center", color: "#ec4899" }}>{children}</span>
        </div>
      </div>

      <Slider s={s} label="Custom Bonus / Piece Work" min={0} max={5000} step={100}
        value={bonus} onChange={setBonus} format={PESO} color="#f5a623" />

      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: s(10), padding: `${s(12)}px ${s(14)}px`, marginTop: s(4) }}>
        {[["Daily Rate (÷313 factor)", PESO(calc.dailyRate)], ["Hourly Rate (÷8)", PESO(calc.hourlyRate)]].map(([lbl, val], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: s(13), marginBottom: i === 0 ? s(4) : 0 }}>
            <span style={{ color: "#64748b" }}>{lbl}</span>
            <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Charts / results panel ─────────────────────────────────────────────────
  const ChartsPanel = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: s(20) }}>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: statCols, gap: s(12) }}>
        <StatCard s={s} label="Gross Income"      value={PESO(calc.grossIncome)}                                    sub="Before deductions"           color="#6366f1" />
        <StatCard s={s} label="Total Deductions"  value={PESO(calc.totalDeductions + calc.withholdingTax)}          sub="Gov't contributions + tax"   color="#ef4444" />
        <StatCard s={s} label="Take-Home"         value={PESO(calc.netPay)}                                         sub="Net pay"                     color="#10b981" />
        <StatCard s={s} label="Deduction Rate"    value={PCT((calc.totalDeductions + calc.withholdingTax) / calc.grossIncome)} sub="Of gross income"  color="#f59e0b" />
      </div>

      {/* Donut + Bar side by side (stacked on phone) */}
      <div style={{ display: "grid", gridTemplateColumns: dualColGrid, gap: s(20) }}>
        {/* Donut */}
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: cardRadius, border: "1px solid rgba(255,255,255,0.08)", padding: `${cardPad}px` }}>
          <div style={{ fontSize: s(13), fontWeight: 600, color: "#94a3b8", marginBottom: s(4) }}>Where Your Money Goes</div>
          <div style={{ fontSize: s(11), color: "#475569", marginBottom: s(16) }}>Monthly gross breakdown</div>
          <ResponsiveContainer width="100%" height={chartH}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={chartH * 0.27} outerRadius={chartH * 0.43} dataKey="value" paddingAngle={3}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
              </Pie>
              <Tooltip content={<CustomTooltipPie />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: `${s(6)}px ${s(14)}px`, marginTop: s(8) }}>
            {pieData.map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: s(5), fontSize: s(11) }}>
                <div style={{ width: s(8), height: s(8), borderRadius: s(2), background: d.color, flexShrink: 0 }} />
                <span style={{ color: "#64748b" }}>{d.name}</span>
                <span style={{ color: "#94a3b8", fontWeight: 600 }}>{PESO(d.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Income bar */}
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: cardRadius, border: "1px solid rgba(255,255,255,0.08)", padding: `${cardPad}px` }}>
          <div style={{ fontSize: s(13), fontWeight: 600, color: "#94a3b8", marginBottom: s(4) }}>Gross Income Breakdown</div>
          <div style={{ fontSize: s(11), color: "#475569", marginBottom: s(16) }}>What makes up your paycheck</div>
          <ResponsiveContainer width="100%" height={chartH + s(10)}>
            <BarChart data={barData} layout="vertical" margin={{ left: s(10), right: s(30) }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" tickFormatter={v => "₱" + (v / 1000).toFixed(0) + "K"} tick={{ fontSize: s(10), fill: "#475569" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: s(11), fill: "#94a3b8" }} axisLine={false} tickLine={false} width={s(70)} />
              <Bar dataKey="amount" radius={s(4)}>
                {barData.map((_, i) => <Cell key={i} fill={["#6366f1","#8b5cf6","#ec4899","#06b6d4","#f5a623"][i]} />)}
              </Bar>
              <Tooltip formatter={v => PESO(v)} contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: s(8) }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Deductions line-by-line */}
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: cardRadius, border: "1px solid rgba(255,255,255,0.08)", padding: `${cardPad}px` }}>
        <div style={{ fontSize: s(13), fontWeight: 600, color: "#94a3b8", marginBottom: s(16) }}>Government Deductions — Line by Line</div>
        {[
          { name: "SSS Contribution",    amount: calc.sss,            color: CHART_COLORS.sss,        law: "RA 11199",     rate: "5% of MSC",       tip: "5% of your Monthly Salary Credit (MSC), rounded to the nearest ₱500. Employer pays the other 10%. Total rate is 15% under the 2026 schedule." },
          { name: "PhilHealth Premium",  amount: calc.philhealth,     color: CHART_COLORS.philhealth, law: "PhilCare 2026", rate: "2.5% employee",   tip: "5% of basic salary, split 50/50. Minimum base ₱10,000, ceiling ₱100,000." },
          { name: "Pag-IBIG (HDMF)",    amount: calc.pagibig,        color: CHART_COLORS.pagibig,    law: "RA 9679",       rate: "2%, max ₱200",    tip: "2% of basic salary, capped at ₱200 once your salary hits ₱10,000." },
          { name: "Withholding Tax (BIR)", amount: calc.withholdingTax, color: CHART_COLORS.tax,     law: "TRAIN Law",     rate: calc.taxNote.label, tip: calc.taxNote.note },
        ].map((d, i) => (
          <div key={i}>
            <div onClick={() => setShowTip(showTip === i ? null : i)}
              style={{ display: "flex", alignItems: "center", gap: s(12), padding: `${s(14)}px ${s(4)}px`, cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ width: s(10), height: s(10), borderRadius: s(3), background: d.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: s(13), color: "#e2e8f0" }}>{d.name}</span>
                {!isPhone && <LawTag s={s} color={d.color}>{d.law}</LawTag>}
              </div>
              {!isPhone && <span style={{ fontSize: s(11), color: "#64748b", marginRight: s(8) }}>{d.rate}</span>}
              <span style={{ fontSize: s(15), fontWeight: 700, color: d.color, minWidth: s(72), textAlign: "right" }}>{PESO(d.amount)}</span>
              <span style={{ fontSize: s(12), color: "#334155" }}>{showTip === i ? "▲" : "▼"}</span>
            </div>
            {showTip === i && <TipBox s={s} note={d.tip} />}
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: `${s(14)}px ${s(4)}px ${s(4)}px`, borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: s(4) }}>
          <span style={{ fontSize: s(13), color: "#94a3b8", fontWeight: 600 }}>Total Deductions</span>
          <span style={{ fontSize: s(18), fontWeight: 800, color: "#ef4444" }}>{PESO(calc.totalDeductions + calc.withholdingTax)}</span>
        </div>
      </div>

      {/* Gross vs Net line chart */}
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: cardRadius, border: "1px solid rgba(255,255,255,0.08)", padding: `${cardPad}px` }}>
        <div style={{ fontSize: s(13), fontWeight: 600, color: "#94a3b8", marginBottom: s(4) }}>Gross vs Net — Across Salary Range</div>
        <div style={{ fontSize: s(11), color: "#475569", marginBottom: s(16) }}>The gap widens as tax kicks in.</div>
        <ResponsiveContainer width="100%" height={chartH}>
          <LineChart data={salaryRange} margin={{ right: s(20) }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="salary" tick={{ fontSize: s(11), fill: "#475569" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => "₱" + (v / 1000).toFixed(0) + "K"} tick={{ fontSize: s(10), fill: "#475569" }} axisLine={false} tickLine={false} />
            <Tooltip formatter={v => PESO(v)} contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: s(8) }} />
            <Line type="monotone" dataKey="gross" stroke="#6366f1" strokeWidth={s(2)} dot={false} name="Gross" />
            <Line type="monotone" dataKey="net"   stroke="#10b981" strokeWidth={s(2)} dot={false} name="Net Take-Home" strokeDasharray="5 3" />
            <Legend formatter={(v) => <span style={{ color: "#94a3b8", fontSize: s(12) }}>{v}</span>} />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ fontSize: s(11), color: "#475569", marginTop: s(8), textAlign: "center" }}>
          ↑ The dashed green line flattens relative to purple once annual taxable income crosses ₱250K — that's TRAIN Law in action.
        </div>
      </div>

      {/* Budget */}
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: cardRadius, border: "1px solid rgba(255,255,255,0.08)", padding: `${cardPad}px` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: s(16), flexWrap: "wrap", gap: s(10) }}>
          <div>
            <div style={{ fontSize: s(13), fontWeight: 600, color: "#94a3b8", marginBottom: s(4) }}>Monthly Family Budget</div>
            <div style={{ fontSize: s(11), color: "#475569" }}>
              {children === 0 ? "No kids" : `Parent + ${children} child${children > 1 ? "ren" : ""}`} — realistic Filipino estimates
            </div>
          </div>
          <div style={{
            textAlign: "right", background: calc.surplus >= 0 ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
            borderRadius: s(10), padding: `${s(8)}px ${s(14)}px`,
            border: `1px solid ${calc.surplus >= 0 ? "#10b98144" : "#ef444444"}`
          }}>
            <div style={{ fontSize: s(11), color: "#64748b" }}>{calc.surplus >= 0 ? "Monthly surplus" : "Monthly shortfall"}</div>
            <div style={{ fontSize: s(20), fontWeight: 800, color: calc.surplus >= 0 ? "#10b981" : "#ef4444" }}>{PESO(Math.abs(calc.surplus))}</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={chartH}>
          <BarChart data={budgetData} margin={{ right: s(10) }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: s(11), fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => "₱" + (v / 1000).toFixed(1) + "K"} tick={{ fontSize: s(10), fill: "#475569" }} axisLine={false} tickLine={false} />
            <Tooltip formatter={v => PESO(v)} contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: s(8) }} />
            <Bar dataKey="amount" radius={s(6)}>
              {budgetData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: "grid", gridTemplateColumns: budgetDetailCols, gap: `${s(4)}px ${s(24)}px`, marginTop: s(16) }}>
          {budgetData.map((d, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: s(12), padding: `${s(5)}px 0`, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: s(6) }}>
                <div style={{ width: s(6), height: s(6), borderRadius: s(2), background: d.color }} />
                <span style={{ color: "#64748b" }}>{d.name}</span>
              </div>
              <span style={{ color: "#94a3b8", fontWeight: 600 }}>{PESO(d.amount)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: s(13), padding: `${s(10)}px 0 0`, fontWeight: 700, gridColumn: "1/-1" }}>
            <span style={{ color: "#94a3b8" }}>Total Expenses</span>
            <span style={{ color: "#f1f5f9" }}>{PESO(calc.totalExpenses)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: s(13), padding: `${s(6)}px 0 0`, fontWeight: 700, gridColumn: "1/-1" }}>
            <span style={{ color: "#94a3b8" }}>Take-Home Pay</span>
            <span style={{ color: "#10b981" }}>{PESO(calc.netPay)}</span>
          </div>
        </div>
        {children > 2 && (
          <div style={{ marginTop: s(12), fontSize: s(12), color: "#64748b", background: "rgba(99,102,241,0.08)", borderRadius: s(8), padding: `${s(8)}px ${s(12)}px`, borderLeft: `${s(3)}px solid #6366f1` }}>
            💡 With more than 2 children, rent estimate increases by ₱1,000.
          </div>
        )}
      </div>

    </div>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0f1e 0%, #0f1b2d 60%, #0d1a2a 100%)",
      fontFamily: "'Inter', 'Space Grotesk', system-ui, sans-serif",
      color: "#f1f5f9",
      paddingBottom: s(60)
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* ── Header ── */}
      <div style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: `${s(24)}px ${mainPadH}px ${s(20)}px` }}>
        <div style={{ maxWidth: isTV ? 1600 : 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: s(12), marginBottom: s(6) }}>
            <div style={{ width: s(36), height: s(36), borderRadius: s(10), background: "#f5a623", display: "flex", alignItems: "center", justifyContent: "center", fontSize: s(18) }}>₱</div>
            <div>
              <div style={{ fontSize: s(11), color: "#64748b", letterSpacing: 2, textTransform: "uppercase" }}>Bank Security Guard</div>
              <div style={{ fontSize: s(22), fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", color: "#f1f5f9", lineHeight: 1.1 }}>
                Sweldo Calculator
              </div>
            </div>
          </div>
          <div style={{ fontSize: s(12), color: "#475569", marginTop: s(4) }}>
            Compliant with 2026 SSS (15%), PhilHealth (5%), Pag-IBIG (₱200 cap), and BIR TRAIN Law
          </div>
        </div>
      </div>

      <div style={{ maxWidth: isTV ? 1600 : 1100, margin: "0 auto", padding: `0 ${mainPadH}px` }}>

        {/* ── Hero number ── */}
        <div style={{ textAlign: "center", padding: `${s(36)}px 0 ${s(20)}px` }}>
          <div style={{ fontSize: s(12), color: "#64748b", letterSpacing: 2, textTransform: "uppercase", marginBottom: s(8) }}>Estimated Take-Home Pay</div>
          <div style={{ fontSize: heroFontSize, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", color: "#10b981", lineHeight: 1, textShadow: "0 0 40px rgba(16,185,129,0.25)" }}>
            {PESO(calc.netPay)}
          </div>
          <div style={{ fontSize: s(13), color: "#475569", marginTop: s(8) }}>
            per month after all deductions &nbsp;·&nbsp; Gross: <span style={{ color: "#6366f1" }}>{PESO(calc.grossIncome)}</span>
          </div>
          <div style={{ marginTop: s(12) }}>
            <span style={{ background: calc.taxNote.color + "22", color: calc.taxNote.color, border: `1px solid ${calc.taxNote.color}55`, borderRadius: s(20), padding: `${s(6)}px ${s(18)}px`, fontSize: s(13), fontWeight: 600 }}>
              {calc.taxNote.label} — Annual taxable: {PESO(calc.annualTaxable)}
            </span>
          </div>
        </div>

        {/* ── Phone: tab switcher ── */}
        {isPhone && (
          <div style={{ display: "flex", gap: 0, marginBottom: s(16), borderRadius: s(12), overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
            {[["inputs", "⚙️ Inputs"], ["charts", "📊 Results"]].map(([key, label]) => (
              <button key={key} onClick={() => setMobileTab(key)} style={{
                flex: 1, padding: `${s(12)}px`, fontSize: s(13), fontWeight: 600,
                background: mobileTab === key ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.04)",
                color: mobileTab === key ? "#a5b4fc" : "#64748b",
                border: "none", cursor: "pointer",
                borderRight: key === "inputs" ? "1px solid rgba(255,255,255,0.1)" : "none"
              }}>{label}</button>
            ))}
          </div>
        )}

        {/* ── Layout ── */}
        {isPhone ? (
          // PHONE: two tabs
          <>
            {mobileTab === "inputs" && <ControlsPanel />}
            {mobileTab === "charts" && <ChartsPanel />}
          </>
        ) : (
          // TABLET / DESKTOP / TV: side-by-side
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? `${leftColWidth}px 1fr` : `${leftColWidth}px 1fr`,
            gap: s(24),
            marginTop: s(8),
            alignItems: "start"
          }}>
            <ControlsPanel />
            <ChartsPanel />
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: s(40), fontSize: s(11), color: "#334155" }}>
          Calculated using 313-day DOLE factor · 2026 SSS (15%) · PhilHealth 5% · Pag-IBIG ₱200 cap · BIR TRAIN Law (RA 10963)
        </div>
      </div>
    </div>
  );
}