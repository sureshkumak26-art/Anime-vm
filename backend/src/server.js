import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'node:crypto';
import http from 'node:http';
import { PrismaClient } from '@prisma/client';
import { WebSocketServer } from 'ws';

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();
const port = Number(process.env.PORT || 4000);
const adminKey = process.env.ADMIN_API_KEY;
const agentKey = process.env.AGENT_API_KEY;
const sessions = new Map();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

function requireAdmin(req,res,next){
  if (!adminKey || req.header('x-admin-key') !== adminKey) return res.status(401).json({error:'Unauthorized'});
  next();
}
function requireAgent(req,res,next){
  if (!agentKey || req.header('x-agent-key') !== agentKey) return res.status(401).json({error:'Unauthorized'});
  next();
}
function cleanNode(n,count){return {id:n.id,name:n.name,host:n.host,port:n.port,status:n.status,active:n.active,priority:n.priority,maxVPS:n.maxVPS,lastCheckedAt:n.lastCheckedAt,vpsCount:count};}

app.get('/api/v1/health', async (_req,res)=>res.json({ok:true,service:'anime-cloud-api',mode:'kvm-libvirt'}));
app.get('/api/v1/plans',(_req,res)=>res.json({plans:[
{name:'Tiny',ramMB:1024,cpuCores:1,diskGB:10,price:19},{name:'Starter',ramMB:2048,cpuCores:2,diskGB:20,price:39},{name:'Basic',ramMB:3072,cpuCores:2,diskGB:30,price:59},{name:'Plus',ramMB:4096,cpuCores:2,diskGB:40,price:79},{name:'Standard',ramMB:6144,cpuCores:4,diskGB:60,price:99},{name:'Premium',ramMB:8192,cpuCores:4,diskGB:80,price:149},{name:'Pro',ramMB:12288,cpuCores:6,diskGB:120,price:199},{name:'Elite',ramMB:16384,cpuCores:8,diskGB:160,price:299},{name:'Extreme',ramMB:24576,cpuCores:10,diskGB:240,price:449},{name:'Ultimate',ramMB:32768,cpuCores:12,diskGB:320,price:599}]}));

app.get('/api/v1/nodes',async(_req,res)=>{const ns=await prisma.node.findMany({where:{active:true},include:{_count:{select:{vps:true}}},orderBy:[{priority:'asc'},{name:'asc'}]});res.json({nodes:ns.map(n=>cleanNode(n,n._count.vps))});});
app.get('/api/v1/admin/nodes',requireAdmin,async(_req,res)=>{const ns=await prisma.node.findMany({include:{_count:{select:{vps:true}}},orderBy:[{priority:'asc'},{name:'asc'}]});res.json({nodes:ns.map(n=>cleanNode(n,n._count.vps))});});
app.post('/api/v1/admin/nodes',requireAdmin,async(req,res)=>{const {name,host,port=9443,priority=100,maxVPS=null}=req.body||{};if(!name||!host)return res.status(400).json({error:'name and host required'});try{const n=await prisma.node.create({data:{name,host,port:Number(port),priority:Number(priority),maxVPS:maxVPS==null?null:Number(maxVPS)}});res.status(201).json({node:cleanNode(n,0)});}catch(e){res.status(400).json({error:e.message});}});
app.patch('/api/v1/admin/nodes/:id',requireAdmin,async(req,res)=>{const allowed=['name','host','port','active','priority','maxVPS'];const data=Object.fromEntries(Object.entries(req.body||{}).filter(([k])=>allowed.includes(k)));if(data.port)data.port=Number(data.port);try{const n=await prisma.node.update({where:{id:req.params.id},data});res.json({node:cleanNode(n)});}catch(e){res.status(404).json({error:'Node not found'});}});
app.delete('/api/v1/admin/nodes/:id',requireAdmin,async(req,res)=>{const n=await prisma.node.findUnique({where:{id:req.params.id}});if(!n)return res.status(404).json({error:'Node not found'});const count=await prisma.vPS.count({where:{nodeId:n.id}}).catch(()=>0);if(count)return res.status(409).json({error:'Node has VPS records'});await prisma.node.delete({where:{id:n.id}});res.json({ok:true});});

// KVM node agents call this endpoint to report health and capacity.
app.post('/api/v1/agent/heartbeat',requireAgent,async(req,res)=>{const {nodeId,hostname,resources}=req.body||{};if(!nodeId)return res.status(400).json({error:'nodeId required'});const n=await prisma.node.update({where:{id:String(nodeId)},data:{status:'ONLINE',lastCheckedAt:new Date()}}).catch(()=>null);if(!n)return res.status(404).json({error:'Unknown node'});res.json({ok:true,serverTime:new Date().toISOString(),hostname,resources});});

// Agent actions: the controller validates the node, then the node agent executes libvirt commands locally.
app.post('/api/v1/agent/action',requireAgent,async(req,res)=>{const {nodeId,action,vmid,payload}=req.body||{};const allowed=['start','stop','reboot','shutdown','destroy','reinstall','status','metrics'];if(!nodeId||!allowed.includes(action))return res.status(400).json({error:'Invalid node/action'});res.json({accepted:true,nodeId,action,vmid,payload});});

app.get('/api/v1/vps',async(req,res)=>{const nodeId=req.query.nodeId;const vps=await prisma.vPS.findMany({where:nodeId?{nodeId:String(nodeId)}:{},include:{node:true,plan:true},orderBy:{createdAt:'desc'}}).catch(()=>[]);res.json({vps});});

app.post('/api/v1/admin/ssh/session',requireAdmin,async(req,res)=>{const {host,port=22,username='root',privateKey}=req.body||{};if(!host||!privateKey)return res.status(400).json({error:'host and privateKey required'});const id=crypto.randomBytes(24).toString('hex');sessions.set(id,{host,port:Number(port),username,privateKey,expires:Date.now()+Number(process.env.SSH_SESSION_TTL_MS||300000)});res.json({session:id,expiresAt:new Date(Date.now()+Number(process.env.SSH_SESSION_TTL_MS||300000)).toISOString()});});

const wss=new WebSocketServer({noServer:true});
server.on('upgrade',(req,socket,head)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname!=='/ws/ssh')return socket.destroy();const s=sessions.get(u.searchParams.get('session'));if(!s||s.expires<Date.now())return socket.destroy();wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,s));}catch{socket.destroy();}});
wss.on('connection',(ws,s)=>{import('ssh2').then(({Client})=>{const c=new Client();c.on('ready',()=>c.shell({term:'xterm-256color',cols:120,rows:30},(err,stream)=>{if(err)return c.end();ws.on('message',d=>stream.write(d.toString()));stream.on('data',d=>{if(ws.readyState===ws.OPEN)ws.send(d.toString());});ws.on('close',()=>c.end());})).on('error',()=>ws.close()).connect({host:s.host,port:s.port,username:s.username,privateKey:s.privateKey,readyTimeout:10000});}).catch(()=>ws.close());});
setInterval(()=>{for(const [id,s] of sessions)if(s.expires<Date.now())sessions.delete(id);},30000);
server.listen(port,()=>console.log(`Anime Cloud KVM API listening on ${port}`));
