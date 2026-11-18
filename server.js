'use strict';
// Banco de dados
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');
const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8000);
const db = new Database(path.join(ROOT, 'loja.db'));
db.pragma('journal_mode = WAL');
db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
db.exec(fs.readFileSync(path.join(ROOT,'schema.sql'),'utf8'));
if (db.prepare('SELECT COUNT(*) AS n FROM produto').get().n === 0) db.exec(fs.readFileSync(path.join(ROOT,'insert.sql'),'utf8'));
if (!db.prepare('PRAGMA table_info(cliente)').all().some(c=>c.name==='papel')) db.exec("ALTER TABLE cliente ADD COLUMN papel TEXT NOT NULL DEFAULT 'cliente'");
db.exec(`CREATE TABLE IF NOT EXISTS auditoria_permissao (id INTEGER PRIMARY KEY, autor_id INTEGER NOT NULL, usuario_id INTEGER NOT NULL, anterior TEXT NOT NULL, novo TEXT NOT NULL, criado_em TEXT DEFAULT CURRENT_TIMESTAMP);`);
db.exec(`CREATE TABLE IF NOT EXISTS carrinho_item (cliente_id INTEGER NOT NULL REFERENCES cliente(id_cli) ON DELETE CASCADE, produto_id INTEGER NOT NULL REFERENCES produto(id) ON DELETE CASCADE, quantidade INTEGER NOT NULL CHECK(quantidade BETWEEN 1 AND 100), PRIMARY KEY(cliente_id,produto_id));
CREATE TABLE IF NOT EXISTS favorito (cliente_id INTEGER NOT NULL REFERENCES cliente(id_cli) ON DELETE CASCADE, produto_id INTEGER NOT NULL REFERENCES produto(id) ON DELETE CASCADE, PRIMARY KEY(cliente_id,produto_id));`);
// Consultas SQL
const stmt = sql => db.prepare(sql);
const now = () => Math.floor(Date.now()/1000);
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const senhaHash = senha => {const salt=crypto.randomBytes(16).toString('hex');return `${salt}:${crypto.scryptSync(senha,salt,64).toString('hex')}`;};
const confereSenha=(senha,stored)=>{try{const [salt,h]=stored.split(':');const a=crypto.scryptSync(senha,salt,64),b=Buffer.from(h,'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b)}catch{return false}};
const cookie = req => Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2));
const current = req => {const token=cookie(req).sessao;if(!token)return null;return stmt('SELECT c.id_cli,c.nome_cli,c.email_cli,c.telefone_cli,c.endereco_cli,c.papel FROM sessao s JOIN cliente c ON c.id_cli=s.cliente_id WHERE s.token_hash=? AND s.expira_em>?').get(hash(token),now())||null;};
const json=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data));};
const fail=(status,msg)=>Object.assign(new Error(msg),{status});
const session=(res,id)=>{const token=crypto.randomBytes(32).toString('hex');stmt('INSERT INTO sessao(token_hash,cliente_id,expira_em) VALUES(?,?,?)').run(hash(token),id,now()+7*86400);res.setHeader('Set-Cookie',`sessao=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);};
const body=async req=>{let s='';for await(const chunk of req){s+=chunk;if(s.length>100000)throw fail(413,'Dados muito grandes')}try{return JSON.parse(s||'{}')}catch{throw fail(400,'JSON inválido')}};
const required=(s,min=1,max=200)=>typeof s==='string'&&s.trim().length>=min&&s.trim().length<=max;
const admin=req=>{const c=current(req);if(!c)throw fail(401,'Faça login.');if(!['admin','proprietario'].includes(c.papel))throw fail(403,'Acesso restrito a administradores.');return c};
const dono=req=>{const c=admin(req);if(c.papel!=='proprietario')throw fail(403,'Apenas o proprietário pode alterar permissões.');return c};
const validarProduto=b=>{if(!required(b.nome,2,150)||!required(b.categoria,1,60)||!Number.isFinite(Number(b.preco))||Number(b.preco)<0||!Number.isSafeInteger(Number(b.estoque))||Number(b.estoque)<0||typeof b.imagem!=='string'||b.imagem.length>400||b.imagem.startsWith('http')||b.imagem.includes('..'))throw fail(400,'Dados do produto inválidos.');return [b.nome.trim(),Number(b.preco),b.precoOriginal===''||b.precoOriginal==null?null:Number(b.precoOriginal),b.imagem.trim(),b.categoria.trim(),Number(b.estoque),b.destaque?1:0]};
const emailOk=s=>required(s,3,254)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
async function api(req,res,url){
 const method=req.method,route=url.pathname;
 if(method==='GET'&&route==='/api/produtos')return json(res,200,{produtos:stmt('SELECT * FROM produto ORDER BY id').all()});
 if(method==='GET'&&route.startsWith('/api/produtos/')){const id=Number(route.split('/').pop());const produto=stmt('SELECT * FROM produto WHERE id=?').get(id);if(!produto)throw fail(404,'Produto não encontrado');return json(res,200,{produto});}
 if(method==='GET'&&route==='/api/admin/resumo'){admin(req);return json(res,200,{produtos:stmt('SELECT COUNT(*) n FROM produto').get().n,clientes:stmt('SELECT COUNT(*) n FROM cliente').get().n,pedidos:stmt('SELECT COUNT(*) n FROM pedido').get().n,vendas:stmt('SELECT COALESCE(SUM(valor_total),0) n FROM pedido').get().n});}
 if(method==='GET'&&route==='/api/admin/usuarios'){admin(req);return json(res,200,{usuarios:stmt('SELECT id_cli,nome_cli,email_cli,telefone_cli,criado_em,papel FROM cliente ORDER BY id_cli DESC').all()});}
 if(method==='PATCH'&&/^\/api\/admin\/usuarios\/\d+\/papel$/.test(route)){
  const autor=dono(req),id=Number(route.split('/')[4]),b=await body(req);
  if(!['cliente','admin'].includes(b.papel))throw fail(400,'Permissão inválida.');
  const u=stmt('SELECT id_cli,papel FROM cliente WHERE id_cli=?').get(id);if(!u)throw fail(404,'Usuário não encontrado');
  if(u.papel==='proprietario')throw fail(403,'O proprietário é protegido.');
  db.transaction(()=>{stmt('UPDATE cliente SET papel=? WHERE id_cli=?').run(b.papel,id);stmt('INSERT INTO auditoria_permissao(autor_id,usuario_id,anterior,novo) VALUES(?,?,?,?)').run(autor.id_cli,id,u.papel,b.papel)})();
  return json(res,200,{ok:true});
 }
 if(method==='GET'&&route==='/api/admin/pedidos'){admin(req);return json(res,200,{pedidos:stmt('SELECT p.*,c.nome_cli,c.email_cli FROM pedido p JOIN cliente c ON c.id_cli=p.cliente_ped ORDER BY id_ped DESC LIMIT 100').all()});}
 if(method==='POST'&&route==='/api/admin/produtos'){admin(req);const vals=validarProduto(await body(req));const r=stmt('INSERT INTO produto(nome,preco,precoOriginal,imagem,categoria,estoque,destaque) VALUES(?,?,?,?,?,?,?)').run(...vals);return json(res,201,{id:Number(r.lastInsertRowid)});}
 if((method==='PUT'||method==='DELETE')&&/^\/api\/admin\/produtos\/\d+$/.test(route)){
  admin(req);const id=Number(route.split('/').pop());if(!stmt('SELECT id FROM produto WHERE id=?').get(id))throw fail(404,'Produto não encontrado');
  if(method==='DELETE'){
    if(stmt('SELECT 1 FROM conteudo_pedido WHERE produto_it=? LIMIT 1').get(id))throw fail(409,'Produto já vendido. Zere o estoque em vez de excluir para preservar o histórico.');
    stmt('DELETE FROM produto WHERE id=?').run(id);return json(res,200,{ok:true});
  }
  const vals=validarProduto(await body(req));stmt('UPDATE produto SET nome=?,preco=?,precoOriginal=?,imagem=?,categoria=?,estoque=?,destaque=? WHERE id=?').run(...vals,id);return json(res,200,{ok:true});
 }
 if(route==='/api/colecao' && method==='GET'){
  const c=current(req);if(!c)return json(res,200,{carrinho:{},favoritos:[]});
  const carrinho=Object.fromEntries(stmt('SELECT produto_id,quantidade FROM carrinho_item WHERE cliente_id=?').all(c.id_cli).map(x=>[x.produto_id,x.quantidade]));
  const favoritos=stmt('SELECT produto_id FROM favorito WHERE cliente_id=?').all(c.id_cli).map(x=>x.produto_id);
  return json(res,200,{carrinho,favoritos});
 }
 if(route==='/api/colecao/carrinho'&&method==='PUT'){
  const c=current(req);if(!c)throw fail(401,'Entre na sua conta para usar o carrinho.');
  const b=await body(req);if(!Number.isSafeInteger(b.id)||!Number.isSafeInteger(b.quantidade)||b.quantidade<0||b.quantidade>100)throw fail(400,'Quantidade inválida.');
  const p=stmt('SELECT estoque FROM produto WHERE id=?').get(b.id);if(!p)throw fail(404,'Produto não encontrado.');
  if(b.quantidade>p.estoque)throw fail(409,'Estoque insuficiente.');
  if(b.quantidade===0)stmt('DELETE FROM carrinho_item WHERE cliente_id=? AND produto_id=?').run(c.id_cli,b.id);
  else stmt('INSERT INTO carrinho_item(cliente_id,produto_id,quantidade) VALUES(?,?,?) ON CONFLICT(cliente_id,produto_id) DO UPDATE SET quantidade=excluded.quantidade').run(c.id_cli,b.id,b.quantidade);
  return json(res,200,{ok:true});
 }
 if(route==='/api/colecao/favoritos'&&method==='PUT'){
  const c=current(req);if(!c)throw fail(401,'Entre na sua conta para salvar favoritos.');
  const b=await body(req);if(!Number.isSafeInteger(b.id)||typeof b.favorito!=='boolean')throw fail(400,'Dados inválidos.');
  if(!stmt('SELECT id FROM produto WHERE id=?').get(b.id))throw fail(404,'Produto não encontrado.');
  if(b.favorito)stmt('INSERT OR IGNORE INTO favorito(cliente_id,produto_id) VALUES(?,?)').run(c.id_cli,b.id);
  else stmt('DELETE FROM favorito WHERE cliente_id=? AND produto_id=?').run(c.id_cli,b.id);
  return json(res,200,{ok:true});
 }
 if(method==='GET'&&route==='/api/me')return json(res,200,{cliente:current(req)});
 if(method==='POST'&&route==='/api/cadastro'){
  const b=await body(req);if(!required(b.nome,2,100)||!emailOk(b.email)||!required(b.senha,8,128))throw fail(400,'Preencha nome, e-mail e senha (mínimo 8 caracteres).');
  const email=b.email.trim().toLowerCase();if(stmt('SELECT id_cli FROM cliente WHERE email_cli=?').get(email))throw fail(409,'E-mail já cadastrado.');
  const r=stmt('INSERT INTO cliente(nome_cli,email_cli,senha_hash) VALUES(?,?,?)').run(b.nome.trim(),email,senhaHash(b.senha));session(res,Number(r.lastInsertRowid));return json(res,201,{ok:true});
 }
 if(method==='POST'&&route==='/api/login'){
  const b=await body(req);if(!emailOk(b.email)||typeof b.senha!=='string')throw fail(400,'Dados inválidos.');
  const c=stmt('SELECT * FROM cliente WHERE email_cli=?').get(b.email.trim().toLowerCase());if(!c||!confereSenha(b.senha,c.senha_hash))throw fail(401,'E-mail ou senha incorretos.');
  session(res,c.id_cli);return json(res,200,{ok:true});
 }
 if(method==='POST'&&route==='/api/logout'){
  const token=cookie(req).sessao;if(token)stmt('DELETE FROM sessao WHERE token_hash=?').run(hash(token));
  res.setHeader('Set-Cookie','sessao=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return json(res,200,{ok:true});
 }
 if(method==='POST'&&route==='/api/perfil'){
  const c=current(req);if(!c)throw fail(401,'Entre na sua conta.');const b=await body(req);
  if(!required(b.nome,2,100)||typeof b.telefone!=='string'||b.telefone.length>30||typeof b.endereco!=='string'||b.endereco.length>500)throw fail(400,'Dados inválidos.');
  stmt('UPDATE cliente SET nome_cli=?,telefone_cli=?,endereco_cli=? WHERE id_cli=?').run(b.nome.trim(),b.telefone.trim(),b.endereco.trim(),c.id_cli);return json(res,200,{ok:true});
 }
 if(method==='GET'&&route==='/api/pedidos'){
  const c=current(req);if(!c)throw fail(401,'Entre na sua conta.');
  const pedidos=stmt('SELECT * FROM pedido WHERE cliente_ped=? ORDER BY id_ped DESC').all(c.id_cli).map(p=>({...p,itens:stmt('SELECT cp.*,pr.nome FROM conteudo_pedido cp JOIN produto pr ON pr.id=cp.produto_it WHERE cp.pedido_it=?').all(p.id_ped)}));return json(res,200,{pedidos});
 }
 if(method==='POST'&&route==='/api/pedidos'){
  const c=current(req);if(!c)throw fail(401,'Entre na sua conta.');const b=await body(req);
  if(!Array.isArray(b.itens)||b.itens.length<1||b.itens.length>100)throw fail(400,'Carrinho inválido.');
  const itens=new Map();for(const i of b.itens){if(!Number.isSafeInteger(i.id)||!Number.isSafeInteger(i.quantidade)||i.quantidade<1||i.quantidade>100)throw fail(400,'Quantidade inválida.');itens.set(i.id,(itens.get(i.id)||0)+i.quantidade)}
  let pedidoId,total=0;
  db.exec('BEGIN IMMEDIATE');try{
   const rows=[];for(const [id,qtd] of itens){const p=stmt('SELECT * FROM produto WHERE id=?').get(id);if(!p)throw fail(400,'Produto não encontrado.');if(qtd>p.estoque)throw fail(409,`Estoque insuficiente: ${p.nome}`);rows.push({p,qtd});total+=Math.round(p.preco*100)*qtd;}
   total=Math.round(total)/100;
   pedidoId=Number(stmt('INSERT INTO pedido(cliente_ped,valor_total) VALUES(?,?)').run(c.id_cli,total).lastInsertRowid);
   for(const {p,qtd} of rows){stmt('UPDATE produto SET estoque=estoque-? WHERE id=?').run(qtd,p.id);stmt('INSERT INTO conteudo_pedido(pedido_it,produto_it,quantidade_it,preco_it) VALUES(?,?,?,?)').run(pedidoId,p.id,qtd,p.preco)}
   stmt('DELETE FROM carrinho_item WHERE cliente_id=?').run(c.id_cli);
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e}
  return json(res,201,{pedido_id:pedidoId,total});
 }
 throw fail(404,'Rota não encontrada.');
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.jfif':'image/jpeg','.avif':'image/avif','.gif':'image/gif'};
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url);
 if(req.method!=='GET'&&req.method!=='HEAD')throw fail(405,'Método não permitido.');
 let pathname;try{pathname=decodeURIComponent(url.pathname)}catch{throw fail(400,'Caminho inválido')}
 if(pathname==='/'||pathname==='/index.html')pathname='/index.html';
 const file=path.resolve(ROOT,'.'+pathname);if(!file.startsWith(ROOT+path.sep))throw fail(403,'Acesso negado');
 const ext=path.extname(file).toLowerCase();if(!mime[ext])throw fail(404,'Arquivo não encontrado');
 let stat;try{stat=fs.statSync(file)}catch{throw fail(404,'Arquivo não encontrado')};if(!stat.isFile())throw fail(404,'Arquivo não encontrado');
 res.writeHead(200,{'Content-Type':mime[ext],'X-Content-Type-Options':'nosniff'});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
 }catch(e){json(res,e.status||500,{erro:e.status?e.message:'Erro interno do servidor'});if(!e.status)console.error(e)}});
server.listen(PORT,'127.0.0.1',()=>console.log(`Collector's Hub: http://127.0.0.1:${PORT}`));
