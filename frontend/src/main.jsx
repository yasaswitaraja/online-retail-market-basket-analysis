import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ShoppingBasket, Upload, RefreshCw, Activity, GitCompareArrows, Sparkles } from "lucide-react";
import "./style.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
function App() {
  const [data,setData] = useState(null);
  const [file,setFile] = useState(null);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [tab,setTab] = useState("overview");
  const [algorithm,setAlgorithm] = useState("fpgrowth");
  const [support,setSupport] = useState(0.02);
  const [confidence,setConfidence] = useState(0.2);
  const [lift,setLift] = useState(1.2);
  const [cart,setCart] = useState([]);
  const [recommendations,setRecommendations] = useState([]);

  async function analyze() {
    setLoading(true); setError("");
    try {
      const form = new FormData();
      if (file) form.append("file", file);
      form.append("min_support", String(support));
      form.append("min_confidence", String(confidence));
      form.append("min_lift", String(lift));
      const response = await axios.post(`${API}/api/analyze`, form, {timeout: 180000});
      setData(response.data); setRecommendations([]);
    } catch(e) {
      setError(e.response?.data?.detail || e.message || "Could not connect to the analysis server.");
    } finally { setLoading(false); }
  }
  useEffect(() => { analyze(); }, []);

  async function getRecommendations() {
    if (!cart.length) return;
    try {
      const response = await axios.post(`${API}/api/recommend`, {products:cart, algorithm, top_k:8});
      setRecommendations(response.data.recommendations || []);
    } catch(e) { setError(e.response?.data?.detail || e.message); }
  }

  const rules = data?.[`${algorithm}_rules`] || [];
  const metrics = data?.comparison || [];
  const products = data?.products || [];
  const topProducts = data?.top_products || [];

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><ShoppingBasket size={22}/></div><div><b>Retail Intelligence</b><small>MARKET BASKET ANALYSIS</small></div></div>
      <div className="side-label">WORKSPACE</div>
      {["overview","comparison","rules","recommendations"].map((t,i)=><button className={`nav ${tab===t?"active":""}`} onClick={()=>setTab(t)} key={t}>{[<Activity/>,<GitCompareArrows/>,<ShoppingBasket/>,<Sparkles/>][i]}{["Overview","Algorithm comparison","Association rules","Cross-sell engine"][i]}</button>)}
      <div className="side-note"><b>Analysis settings</b><label>Minimum support <strong>{support.toFixed(3)}</strong></label><input type="range" min=".001" max=".2" step=".001" value={support} onChange={e=>setSupport(+e.target.value)}/><label>Minimum confidence <strong>{confidence.toFixed(2)}</strong></label><input type="range" min=".05" max="1" step=".05" value={confidence} onChange={e=>setConfidence(+e.target.value)}/><label>Minimum lift <strong>{lift.toFixed(1)}</strong></label><input type="range" min="1" max="10" step=".1" value={lift} onChange={e=>setLift(+e.target.value)}/><button className="primary full" onClick={analyze} disabled={loading}>{loading?<RefreshCw className="spin"/>:<RefreshCw size={16}/>} Run analysis</button></div>
      <div className="foot">Academic prototype · Association is not causation</div>
    </aside>
    <main className="main">
      <header><div><span className="eyebrow">ONLINE RETAIL ANALYTICS</span><h1>{({overview:"Market basket overview",comparison:"Algorithm performance",rules:"Association rule explorer",recommendations:"Cross-sell recommendations"})[tab]}</h1><p>Discover products customers frequently purchase together.</p></div><label className="upload"><Upload size={17}/> {file?file.name:"Upload retail CSV"}<input type="file" accept=".csv" onChange={e=>setFile(e.target.files[0])}/></label></header>
      {error && <div className="error">{error} <span>Check that the backend is running and VITE_API_URL is configured.</span></div>}
      {!data && loading ? <div className="loading">Preparing your retail analysis…</div> : data && <>
        <div className="notice">{data.dataset_label}. {data.is_demo ? "Demonstration data is synthetic; upload real retail data for research findings." : "Uploaded dataset successfully processed."}</div>
        <div className="stats"><Metric title="Transactions" value={data.transaction_count}/><Metric title="Unique products" value={data.product_count}/><Metric title="Frequent itemsets (FP)" value={data.fp_itemset_count}/><Metric title="Association rules (FP)" value={data.fp_rule_count}/></div>
        {tab==="overview" && <section className="panel"><h2>Most frequently purchased products</h2><ResponsiveContainer width="100%" height={340}><BarChart data={topProducts} layout="vertical" margin={{left:30,right:20}}><CartesianGrid strokeDasharray="3 3" stroke="#263341"/><XAxis type="number" stroke="#93a4b8"/><YAxis dataKey="product" type="category" width={150} stroke="#93a4b8"/><Tooltip contentStyle={{background:"#111c29",border:"1px solid #344456"}}/><Bar dataKey="line_items" fill="#25a88b" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer></section>}
        {tab==="comparison" && <section className="panel"><h2>Apriori vs FP-Growth</h2><div className="table-wrap"><table><thead><tr><th>Algorithm</th><th>Runtime (seconds)</th><th>Frequent itemsets</th><th>Rules</th></tr></thead><tbody>{metrics.map(x=><tr key={x.algorithm}><td>{x.algorithm}</td><td>{x.runtime_seconds.toFixed(4)}</td><td>{x.itemsets}</td><td>{x.rules}</td></tr>)}</tbody></table></div><p className="muted">Both algorithms use the same transaction matrix and support threshold. Runtime varies by dataset and environment.</p></section>}
        {tab==="rules" && <section className="panel"><div className="panel-head"><h2>Association rules</h2><select value={algorithm} onChange={e=>setAlgorithm(e.target.value)}><option value="fpgrowth">FP-Growth</option><option value="apriori">Apriori</option></select></div><RulesTable rules={rules}/></section>}
        {tab==="recommendations" && <section className="panel"><h2>What should we recommend?</h2><p className="muted">Select products in a customer's basket to find likely add-on products.</p><select multiple value={cart} onChange={e=>setCart([...e.target.selectedOptions].map(o=>o.value))} className="product-select">{products.map(p=><option key={p}>{p}</option>)}</select><div className="actions"><select value={algorithm} onChange={e=>setAlgorithm(e.target.value)}><option value="fpgrowth">FP-Growth rules</option><option value="apriori">Apriori rules</option></select><button className="primary" onClick={getRecommendations}>Find recommendations</button></div>{recommendations.length>0&&<div className="recommendations">{recommendations.map(r=><div className="recommendation" key={r.product}><b>{r.product}</b><span>Confidence {(r.confidence*100).toFixed(1)}%</span><span>Lift {r.lift.toFixed(2)}</span></div>)}</div>}</section>}
      </>}
    </main>
  </div>;
}
function Metric({title,value}) { return <div className="metric"><span>{title}</span><b>{Number(value||0).toLocaleString()}</b></div>; }
function RulesTable({rules=[]}) {
  if(!rules.length) return <p className="muted">No rules match the selected thresholds. Lower support or confidence and rerun analysis.</p>;
  return <div className="table-wrap"><table><thead><tr><th>If customer buys</th><th>Recommend</th><th>Support</th><th>Confidence</th><th>Lift</th></tr></thead><tbody>{rules.slice(0,150).map((r,i)=><tr key={i}><td>{r.antecedents.join(", ")}</td><td className="green">{r.consequents.join(", ")}</td><td>{r.support.toFixed(3)}</td><td>{r.confidence.toFixed(3)}</td><td>{r.lift.toFixed(2)}</td></tr>)}</tbody></table></div>;
}
createRoot(document.getElementById("root")).render(<App/>);
