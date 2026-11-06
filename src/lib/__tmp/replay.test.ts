import { test } from "vitest";
import { readFileSync } from "fs";
import { openRentalBins } from "../rental-open-movements";
import { categoriseContainer, containerTypeCap } from "../overRental";
import { withStandingBins } from "../standing-bins";
const settings: any = { rental_free_days: -1, artic_vehicle_regs: [], artic_container_keywords: ["curtain side"], roro_container_keywords: ["ro ro","roll on roll off"], skip_container_keywords: ["skip","yard","yd","chain lift"] };
test("replay", () => {
  const all = JSON.parse(readFileSync("/tmp/sb/jobs.json","utf8"));
  const rules = JSON.parse(readFileSync("/tmp/sb/rules.json","utf8"));
  const today = "2026-11-06";
  const done = all.filter((j: any) => j.job_date <= today);
  const pos = (jobs: any[]) => { // useExpectedStock style
    const P: Record<string, any> = {};
    for (const j of jobs) { if (!j.container_type) continue; const cat = categoriseContainer(j.container_type, null, settings); if (cat!=="skip"&&cat!=="roro") continue;
      const k = `${j.site}|||${j.container_type}|||${j.ewc}`; const p = P[k] ||= {site:j.site,ct:j.container_type,ewc:j.ewc,delivered:0,collected:0,exchanged:0,tipReturn:0,lastKeepDate:null,lastCollectionDate:null};
      const m=j.movement_type; if(m==="Collect"){p.collected++; if(!p.lastCollectionDate||j.job_date>p.lastCollectionDate)p.lastCollectionDate=j.job_date;} else { if(m==="Exchange")p.exchanged++; else if(m==="Tip/Return")p.tipReturn++; else p.delivered++; if(!p.lastKeepDate||j.job_date>p.lastKeepDate)p.lastKeepDate=j.job_date; } }
    const G: Record<string, any[]> = {}; for (const p of Object.values(P)) (G[`${p.site}|||${p.ct}`] ||= []).push(p);
    const out: Record<string, number> = {};
    for (const [k, g] of Object.entries(G)) { const on = (p:any)=>{const net=p.delivered-p.collected; const cl=p.lastCollectionDate&&p.lastKeepDate&&p.lastCollectionDate>=p.lastKeepDate; if(cl&&net<=0)return 0; const pr=p.exchanged>0||p.tipReturn>0; return Math.max(net, net>=0&&pr?Math.max(1,net):0);};
      out[k] = Math.min(g.reduce((s,p)=>s+on(p),0), containerTypeCap(g)); }
    return out; };
  const b = pos(all), a = pos(withStandingBins(all, rules, today));
  for (const k of Object.keys(a).sort()) if (a[k] || b[k]) console.log("STOCK", k, b[k], "->", a[k]);
  const rb = openRentalBins(done, settings, "2025-12-01", categoriseContainer as any, today);
  const ra = openRentalBins(withStandingBins(done, rules, today), settings, "2025-12-01", categoriseContainer as any, today);
  const s = (r: any[]) => Object.fromEntries(r.map(x => [`${x.site}|${x.containerType}|${x.wasteTypes.join("/")}`, `${x.netOnSite} last ${x.lastActivityDate}`]));
  console.log("RENT before", s(rb)); console.log("RENT after", s(ra));
});
