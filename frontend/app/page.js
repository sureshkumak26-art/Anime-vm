'use client';
import { useEffect, useMemo, useState } from 'react';
import './theme.css';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export default function Home() {
  const [plans, setPlans] = useState([]);
  const [vps, setVps] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError('');
    try {
      const [p, v, n] = await Promise.all([
        fetch(`${API}/plans`), fetch(`${API}/vps`), fetch(`${API}/nodes`)
      ]);
      if (!p.ok) throw new Error('Anime Cloud API unavailable');
      setPlans((await p.json()).plans || []);
      if (v.ok) setVps((await v.json()).data || []);
      if (n.ok) setNodes((await n.json()).data || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);
  async function action(vmid, action) { await fetch(`${API}/vps/${vmid}/${action}`, { method: 'POST' }); load(); }
  const running = useMemo(() => vps.filter(x => String(x.status).toLowerCase() === 'running').length, [vps]);

  return <main className="site">
    <div className="stars" />
    <nav className="nav">
      <div className="brand"><span className="brandIcon">✦</span><span>ANIME <b>CLOUD</b></span></div>
      <div className="navlinks"><a href="#vps">VPS</a><a href="#plans">Pricing</a><a href="#nodes">Nodes</a><a href="#status">Status</a></div>
      <button className="navBtn">Dashboard ↗</button>
    </nav>

    <section className="hero">
      <div className="heroCopy">
        <div className="eyebrow"><span className="pulse" /> NEXT-GEN VPS CLOUD</div>
        <h1>Power your world.<br/><span>Deploy without limits.</span></h1>
        <p>High-performance VPS hosting powered by NVMe storage, scalable compute and a growing global node network.</p>
        <div className="heroBtns"><a className="primary" href="#plans">Explore VPS Plans</a><a className="secondary" href="#vps">Open Control Panel</a></div>
        <div className="trust"><span>⚡ Instant Deploy</span><span>◆ NVMe</span><span>◉ 24/7 Monitoring</span></div>
      </div>
      <div className="orbWrap"><div className="orbit orbit1"/><div className="orbit orbit2"/><div className="cloudOrb"><div className="orbLogo">✦</div><strong>ANIME<br/>CLOUD</strong><small>GLOBAL COMPUTE</small></div><div className="floatCard c1">⚡ <b>99.99%</b><small>Uptime</small></div><div className="floatCard c2">◈ <b>NVMe</b><small>Storage</small></div><div className="floatCard c3">● <b>ONLINE</b><small>All systems</small></div></div>
    </section>

    {error && <div className="alert">⚠ {error}</div>}

    <section className="stats" id="status">
      <Stat value={vps.length} label="VPS DEPLOYED"/><Stat value={running} label="VPS RUNNING"/><Stat value={nodes.length} label="CLOUD NODES"/><Stat value={plans.length} label="VPS PLANS"/>
    </section>

    <section className="section" id="vps"><div className="sectionHead"><div><div className="eyebrow">CONTROL CENTER</div><h2>Your VPS fleet</h2></div><button className="refresh" onClick={load}>↻ Refresh</button></div>
      {loading ? <div className="empty">Loading Anime Cloud…</div> : vps.length ? <div className="vpsGrid">{vps.map(vm => <div className="vpsCard" key={vm.vmid}><div className="vpsTop"><div className="serverIcon">⌁</div><div><h3>{vm.name || `VPS-${vm.vmid}`}</h3><span>VMID {vm.vmid}</span></div><i className="onlineDot"/></div><div className="meter"><span>STATUS</span><b>{vm.status || 'UNKNOWN'}</b></div><div className="actions"><button onClick={()=>action(vm.vmid,'start')}>Start</button><button onClick={()=>action(vm.vmid,'stop')}>Stop</button><button onClick={()=>action(vm.vmid,'reboot')}>Reboot</button></div></div>)}</div> : <div className="empty">No VPS detected. Connect a Proxmox node to begin.</div>}
    </section>

    <section className="section" id="plans"><div className="sectionHead"><div><div className="eyebrow">SIMPLE PRICING</div><h2>Choose your power</h2></div></div><div className="plansGrid">{plans.map((p,i)=><div className={`plan ${i===3?'featured':''}`} key={p.name}>{i===3&&<div className="popular">MOST POPULAR</div>}<h3>{p.name}</h3><div className="price">₹{p.price}<small>/mo</small></div><ul><li>⚡ {p.cpuCores} vCPU</li><li>▣ {p.ramMB/1024} GB RAM</li><li>◆ {p.diskGB} GB NVMe</li><li>◉ DDoS-ready network</li></ul><button>Deploy {p.name}</button></div>)}</div></section>

    <section className="section" id="nodes"><div className="sectionHead"><div><div className="eyebrow">GLOBAL NETWORK</div><h2>Growing cloud infrastructure</h2></div></div><div className="nodeGrid">{nodes.length ? nodes.map((n,i)=><div className="nodeCard" key={n.id||i}><span className="nodePing"/><div><h3>{n.name || `Node ${i+1}`}</h3><small>{n.host || 'Proxmox node'} · Port {n.port || 8006}</small></div><b>{n.active === false ? 'OFFLINE' : 'ONLINE'}</b></div>) : <div className="empty">Add Proxmox nodes from the admin panel.</div>}</div></section>

    <footer><div className="brand"><span className="brandIcon">✦</span> ANIME <b>CLOUD</b></div><span>© 2026 Anime Cloud · Built for speed.</span></footer>
  </main>;
}
function Stat({value,label}) { return <div className="stat"><strong>{value}</strong><span>{label}</span><div className="growLine"><i/></div></div>; }
