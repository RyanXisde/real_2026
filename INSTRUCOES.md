# Collector’s Hub — Node.js 20 + SQLite

## Executar
Na pasta do projeto, abra o terminal e rode:

```
npm install
node server.js
```

Acesse http://localhost:8000. O servidor cria `loja.db` e importa `insert.sql` na primeira execução. **Não exclua seu `loja.db` existente** ao atualizar: ele guarda clientes e pedidos.

## Primeiro proprietário
1. Cadastre uma conta pelo site.
2. No terminal da mesma pasta, execute `node criar-admin.js`.
3. Informe o e-mail e a senha dessa conta para ativá-la como proprietário.
4. Atualize o site ou saia e entre novamente; na área Minha conta aparecerá **Painel ADM**.

A senha digitada no comando é visível no terminal; faça isso apenas em um computador confiável. O script impede criar um segundo proprietário. Somente o proprietário promove ou remove ADMs; admins podem gerenciar produtos e consultar clientes e pedidos.

## Funcionalidades
- Produtos lidos e gravados no SQLite (não há dados.js/JSON de produtos).
- Cadastro/login, perfil, histórico e pedidos com baixa de estoque.
- Página individual de produto e melhorias responsivas.
- Painel ADM: produtos, clientes, permissões e pedidos.
- Histórico de alterações de permissão na tabela `auditoria_permissao`.

## Importante
- Mantenha suas imagens nas pastas `imagens/` e `imagem/` (não incluídas neste ZIP).
- O projeto não processa pagamentos reais.
- Não envie `loja.db`, `node_modules` nem `.env` para o GitHub.
- Este é um projeto educacional/local. Para colocar em produção pública, implemente HTTPS, CSRF, limites de tentativas de login e outras proteções.

## Armazenamento
O projeto não usa localStorage, sessionStorage ou IndexedDB. Carrinho e favoritos são armazenados em tabelas SQLite por cliente autenticado. Para adicionar ao carrinho ou aos favoritos, faça login. A autenticação usa cookie HttpOnly com o identificador de sessão, cujo hash é armazenado no SQLite; o cookie não armazena dados de produtos ou clientes.
