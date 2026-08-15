'use client';
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export default function Home() {
  const [plans, setPlans] = useState([]);
  const [vps, setVps] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [p, v] = await Promise.all([fetch(`${API}/plans`), fetch(`${API}/vps`)]);
      if (!p.ok) throw new Error('API unavailable');
      setPlans((await p.json()).plans || []);
      if (v.ok) setVps((await v.json()).data || []);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function action(vmid, action) {
    await fetch(`${API}/vps/${vmid}/${action}`, { method: 'POST' });
    load();
  }

  return <main style={{minHeight:'100vh',background:'#070b14',color:'#fff',fontFamily:'Arial',padding:'32px'}}>
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:36}}>
      <div><div style={{fontSize:28,fontWeight:800}}>☁ Anime Cloud</div><div style={{color:'#94a3b8'}}>VPS Control Center</div></div>
      <span style={{background:'#10251a',color:'#4ade80',padding:'8px 14px',borderRadius:20}}>● Panel Online</span>
    </header>
    {error && <div style={{background:'#3b1010',padding:14,borderRadius:12,marginBottom:20}}>{error}</div>}
    <section style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:16,marginBottom:32}}>
      {['VPS','Running','Plans'].map((x,i)=><div key={x} style={{background:'#111827',border:'1px solid #1f2937',borderRadius:16,padding:22}}><div style={{color:'#94a3b8'}}>{x}</div><strong style={{fontSize:30}}>{i===0?vps.length:i===1?vps.filter(x=>x.status==='running').length:plans.length}</strong></div>)}
    </section>
    <h2>Your VPS</h2>
    <div style={{display:'grid',gap:14}}>{vps.length ? vps.map(vm=><div key={vm.vmid} style={{background:'#111827',border:'1px solid #1f2937',borderRadius:16,padding:20,display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><b>{vm.name || `VPS-${vm.vmid}`}</b><div style={{color:'#94a3b8'}}>VMID {vm.vmid} · {vm.status}</div></div><div style={{display:'flex',gap:8}}><button onClick={()=>action(vm.vmid,'start')}>Start</button><button onClick={()=>action(vm.vmid,'stop')}>Stop</button><button onClick={()=>action(vm.vmid,'reboot')}>Reboot</button></div></div>):<div style={{color:'#94a3b8'}}>No VPS detected. Connect a Proxmox node to begin.</div>}</div>
    <h2 style={{marginTop:38}}>Plans</h2>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14}}>{plans.map(p=><div key={p.name} style={{background:'#111827',border:'1px solid #1f2937',borderRadius:16,padding:18}}><b>{p.name}</b><div>{p.ramMB/1024} GB RAM</div><div>{p.cpuCores} vCPU · {p.diskGB} GB</div><strong>₹{p.price}/month</strong></div>)}</div>
  </main>;
}
