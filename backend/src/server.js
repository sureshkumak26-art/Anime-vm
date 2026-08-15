import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import axios from 'axios';

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

const api = axios.create({
  baseURL: `${process.env.PROXMOX_URL || ''}/api2/json`,
  timeout: 30000,
  httpsAgent: new (await import('https')).Agent({ rejectUnauthorized: process.env.PROXMOX_TLS_REJECT_UNAUTHORIZED !== 'false' }),
  headers: process.env.PROXMOX_TOKEN_ID && process.env.PROXMOX_TOKEN_SECRET ? {
    Authorization: `PVEAPIToken=${process.env.PROXMOX_TOKEN_ID}=${process.env.PROXMOX_TOKEN_SECRET}`
  } : {}
});

const node = process.env.PROXMOX_NODE || 'pve';

app.get('/api/v1/health', (_req, res) => res.json({ ok: true, service: 'anime-cloud-api' }));

app.get('/api/v1/plans', (_req, res) => res.json({ plans: [
  { name: 'Tiny', ramMB: 1024, cpuCores: 1, diskGB: 10, price: 19 },
  { name: 'Starter', ramMB: 2048, cpuCores: 2, diskGB: 20, price: 39 },
  { name: 'Basic', ramMB: 3072, cpuCores: 2, diskGB: 30, price: 59 },
  { name: 'Plus', ramMB: 4096, cpuCores: 2, diskGB: 40, price: 79 },
  { name: 'Standard', ramMB: 6144, cpuCores: 4, diskGB: 60, price: 99 },
  { name: 'Premium', ramMB: 8192, cpuCores: 4, diskGB: 80, price: 149 },
  { name: 'Pro', ramMB: 12288, cpuCores: 6, diskGB: 120, price: 199 },
  { name: 'Elite', ramMB: 16384, cpuCores: 8, diskGB: 160, price: 299 },
  { name: 'Extreme', ramMB: 24576, cpuCores: 10, diskGB: 240, price: 449 },
  { name: 'Ultimate', ramMB: 32768, cpuCores: 12, diskGB: 320, price: 599 }
] }));

app.get('/api/v1/nodes', async (_req, res) => {
  try {
    const { data } = await api.get('/nodes');
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'Proxmox unavailable', detail: e.response?.data || e.message });
  }
});

app.get('/api/v1/vps', async (_req, res) => {
  try {
    const { data } = await api.get(`/nodes/${encodeURIComponent(node)}/qemu`);
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'Unable to read VPS list', detail: e.response?.data || e.message });
  }
});

async function vmAction(req, res, action) {
  const vmid = Number(req.params.vmid);
  if (!Number.isInteger(vmid) || vmid < 100) return res.status(400).json({ error: 'Invalid VMID' });
  try {
    const { data } = await api.post(`/nodes/${encodeURIComponent(node)}/qemu/${vmid}/status/${action}`);
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: `Unable to ${action} VM`, detail: e.response?.data || e.message });
  }
}

app.get('/api/v1/vps/:vmid/status', async (req, res) => {
  const vmid = Number(req.params.vmid);
  try {
    const { data } = await api.get(`/nodes/${encodeURIComponent(node)}/qemu/${vmid}/status/current`);
    res.json(data);
  } catch (e) { res.status(502).json({ error: 'Unable to read VM status', detail: e.response?.data || e.message }); }
});
app.post('/api/v1/vps/:vmid/start', (req,res) => vmAction(req,res,'start'));
app.post('/api/v1/vps/:vmid/stop', (req,res) => vmAction(req,res,'stop'));
app.post('/api/v1/vps/:vmid/reboot', (req,res) => vmAction(req,res,'reboot'));

app.listen(process.env.PORT || 4000, () => console.log(`Anime Cloud API listening on ${process.env.PORT || 4000}`));
