// Conta do proprietário
const Database=require('better-sqlite3');const crypto=require('node:crypto');const readline=require('node:readline');const path=require('node:path');
const db=new Database(path.join(__dirname,'loja.db'));const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const perguntar=q=>new Promise(r=>rl.question(q,r));
(async()=>{try{
 const cols=db.prepare('PRAGMA table_info(cliente)').all();if(!cols.some(c=>c.name==='papel'))db.exec("ALTER TABLE cliente ADD COLUMN papel TEXT NOT NULL DEFAULT 'cliente'");
 if(db.prepare("SELECT COUNT(*) n FROM cliente WHERE papel='proprietario'").get().n)throw Error('Já existe um proprietário. Nenhuma alteração foi feita.');
 const email=(await perguntar('E-mail de uma conta já cadastrada: ')).trim().toLowerCase();
 const usuario=db.prepare('SELECT id_cli,nome_cli FROM cliente WHERE email_cli=?').get(email);if(!usuario)throw Error('Conta não encontrada. Cadastre-se no site primeiro.');
 const senha=await perguntar('Senha dessa conta (será exibida no terminal): ');
 const stored=db.prepare('SELECT senha_hash FROM cliente WHERE id_cli=?').get(usuario.id_cli).senha_hash;
 const [salt,hash]=stored.split(':');const a=crypto.scryptSync(senha,salt,64),b=Buffer.from(hash,'hex');if(a.length!==b.length||!crypto.timingSafeEqual(a,b))throw Error('Senha incorreta.');
 db.prepare("UPDATE cliente SET papel='proprietario' WHERE id_cli=?").run(usuario.id_cli);console.log('Conta proprietária ativada:',usuario.nome_cli,'(faça login novamente).');
 }catch(e){console.error(e.message);process.exitCode=1}finally{rl.close();db.close()}})();
