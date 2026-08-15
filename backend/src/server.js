import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import axios from 'axios';
import https from 'https';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const port = Number(process.env.PORT || 4000);
const tlsRejectUnauthorized = process.env.PROXMOX_TLS_REJECT_UNAUTHORIZED !== 'false';
const adminKey = process.env.ADMIN_API_KEY;

app.use(helmet());
app.use(cors());
app.use(express.json());

function requireAdmin(req, res, next) {
  if (!adminKey) return res.status(503).json({ error: 'ADMIN_API_KEY is not configured' });
  if (req.header('x-admin-key') !== adminKey) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function proxmoxClient(node) {
  return axios.create({
    baseURL: `https://${node.host}:${node.port}/api2/json`,
    timeout: Number(process.env.PROXMOX_TIMEOUT || 30000),
    httpsAgent: new https.Agent({ rejectUnauthorized: tlsRejectUnauthorized }),
    headers: { Authorization: `PVEAPIToken=${node.tokenId}=${node.tokenSecret}`, Accept: 'application/json' }
  });
}

function proxmoxName(node) {
  return node.proxmoxNodeName || node.name;
}

function publicNode(node, vpsCount) {
  return {
    id: node.id,
    name: node.name,
    proxmoxNodeName: node.proxmoxNodeName,
    host: node.host,
    port: node.port,
    status: node.status,
    active: node.active,
    priority: node.priority,
    maxVPS: node.maxVPS,
    lastCheckedAt: node.lastCheckedAt,
    ...(vpsCount === undefined ? {} : { vpsCount }),
    createdAt: node.createdAt,
    updatedAt: node.updatedAt
  };
}

async function checkNode(node) {
  try {
    const { data } = await proxmoxClient(node).get('/nodes');
    await prisma.node.update({ where: { id: node.id }, data: { status: 'ONLINE', lastCheckedAt: new Date() } });
    return { ...publicNode(node), status: 'ONLINE', proxmoxNodes: data.data ?? [] };
  } catch (error) {
    await prisma.node.update({ where: { id: node.id }, data: { status: 'OFFLINE', lastCheckedAt: new Date() } });
    return { ...publicNode(node), status: 'OFFLINE', error: error.response?.data?.errors || error.message };
  }
}

async function getNodeOr404(id, res) {
  const node = await prisma.node.findUnique({ where: { id } });
  if (!node) { res.status(404).json({ error: 'Node not found' }); return null; }
  return node;
}

app.get('/api/v1/health', async (_req, res) => {
  const nodes = await prisma.node.count({ where: { active: true } }).catch(() => 0);
  res.json({ ok: true, service: 'anime-cloud-api', activeNodes: nodes });
});

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
  const nodes = await prisma.node.findMany({ where: { active: true }, include: { _count: { select: { vps: true } } }, orderBy: [{ priority: 'asc' }, { name: 'asc' }] });
  res.json({ nodes: nodes.map(n => publicNode(n, n._count.vps)) });
});

app.get('/api/v1/admin/nodes', requireAdmin, async (_req, res) => {
  const nodes = await prisma.node.findMany({ include: { _count: { select: { vps: true } } }, orderBy: [{ priority: 'asc' }, { name: 'asc' }] });
  res.json({ nodes: nodes.map(n => publicNode(n, n._count.vps)) });
});

app.post('/api/v1/admin/nodes', requireAdmin, async (req, res) => {
  const { name, proxmoxNodeName, host, port = 8006, tokenId, tokenSecret, priority = 100, maxVPS = null } = req.body || {};
  if (!name || !host || !tokenId || !tokenSecret) return res.status(400).json({ error: 'name, host, tokenId and tokenSecret are required' });
  try {
    const node = await prisma.node.create({
      data: { name, proxmoxNodeName: proxmoxNodeName || name, host, port: Number(port), tokenId, tokenSecret, priority: Number(priority), maxVPS: maxVPS == null ? null : Number(maxVPS) }
    });
    res.status(201).json({ node: await checkNode(node) });
  } catch (error) {
    res.status(400).json({ error: error.code === 'P2002' ? 'Node name already exists' : error.message });
  }
});

app.patch('/api/v1/admin/nodes/:id', requireAdmin, async (req, res) => {
  const allowed = ['name', 'proxmoxNodeName', 'host', 'port', 'tokenId', 'tokenSecret', 'active', 'priority', 'maxVPS'];
  const data = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  if (data.port !== undefined) data.port = Number(data.port);
  if (data.priority !== undefined) data.priority = Number(data.priority);
  if (data.maxVPS !== undefined && data.maxVPS !== null) data.maxVPS = Number(data.maxVPS);
  try {
    const node = await prisma.node.update({ where: { id: req.params.id }, data });
    res.json({ node: publicNode(node) });
  } catch (error) { res.status(404).json({ error: 'Node not found' }); }
});

app.delete('/api/v1/admin/nodes/:id', requireAdmin, async (req, res) => {
  const node = await getNodeOr404(req.params.id, res);
  if (!node) return;
  const count = await prisma.vPS.count({ where: { nodeId: node.id } });
  if (count > 0) return res.status(409).json({ error: 'Cannot delete a node containing VPS records. Move/delete VPS first.' });
  await prisma.node.delete({ where: { id: node.id } });
  res.json({ ok: true });
});

app.post('/api/v1/admin/nodes/:id/test', requireAdmin, async (req, res) => {
  const node = await getNodeOr404(req.params.id, res);
  if (!node) return;
  res.json(await checkNode(node));
});

app.get('/api/v1/admin/nodes/health', requireAdmin, async (_req, res) => {
  const nodes = await prisma.node.findMany({ where: { active: true } });
  res.json({ nodes: await Promise.all(nodes.map(checkNode)) });
});

app.get('/api/v1/vps', async (req, res) => {
  const nodeId = req.query.nodeId;
  const nodes = await prisma.node.findMany({ where: { active: true, ...(nodeId ? { id: String(nodeId) } : {}) } });
  const results = [];
  for (const node of nodes) {
    try {
      const { data } = await proxmoxClient(node).get('/cluster/resources', { params: { type: 'vm' } });
      results.push(...(data.data || []).filter(vm => vm.type === 'qemu').map(vm => ({ ...vm, animeCloudNodeId: node.id, animeCloudNode: node.name })));
    } catch (error) {
      results.push({ animeCloudNodeId: node.id, animeCloudNode: node.name, error: error.response?.data || error.message });
    }
  }
  res.json({ vps: results });
});

async function resolveNode(vmid, nodeId) {
  if (nodeId) return prisma.node.findUnique({ where: { id: String(nodeId) } });
  const vps = await prisma.vPS.findUnique({ where: { vmid: Number(vmid) }, include: { node: true } }).catch(() => null);
  return vps?.node || null;
}

async function vmAction(req, res, action) {
  const vmid = Number(req.params.vmid);
  if (!Number.isInteger(vmid) || vmid < 100) return res.status(400).json({ error: 'Invalid VMID' });
  const node = await resolveNode(vmid, req.query.nodeId || req.body?.nodeId);
  if (!node) return res.status(404).json({ error: 'VPS/node mapping not found. Supply nodeId.' });
  try {
    const { data } = await proxmoxClient(node).post(`/nodes/${encodeURIComponent(proxmoxName(node))}/qemu/${vmid}/status/${action}`);
    res.json({ nodeId: node.id, node: node.name, data });
  } catch (e) { res.status(502).json({ error: `Unable to ${action} VM`, node: node.name, detail: e.response?.data || e.message }); }
}

app.get('/api/v1/vps/:vmid/status', async (req, res) => {
  const vmid = Number(req.params.vmid);
  const node = await resolveNode(vmid, req.query.nodeId);
  if (!node) return res.status(404).json({ error: 'VPS/node mapping not found. Supply nodeId.' });
  try {
    const { data } = await proxmoxClient(node).get(`/nodes/${encodeURIComponent(proxmoxName(node))}/qemu/${vmid}/status/current`);
    res.json({ nodeId: node.id, node: node.name, data });
  } catch (e) { res.status(502).json({ error: 'Unable to read VM status', node: node.name, detail: e.response?.data || e.message }); }
});

app.post('/api/v1/vps/:vmid/start', (req,res) => vmAction(req,res,'start'));
app.post('/api/v1/vps/:vmid/stop', (req,res) => vmAction(req,res,'stop'));
app.post('/api/v1/vps/:vmid/reboot', (req,res) => vmAction(req,res,'reboot'));

app.listen(port, () => console.log(`Anime Cloud API listening on ${port}`));
