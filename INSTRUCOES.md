# PIAS SQL — Node.js 20.16.0

Esta versão mantém HTML, CSS, JavaScript e SQL, sem Python. O banco de dados é SQLite e os produtos são carregados de `insert.sql`, não de `dados.js`.

## Instalação (somente na primeira vez)

1. Extraia o ZIP e copie os arquivos para a pasta **pias_sql-main** ou **dafewagner_pias-main** do seu projeto. **Não apague sua pasta `imagens`**.
2. Abra a pasta no Explorador de Arquivos, digite `powershell` na barra de endereço e aperte Enter.
3. Execute `npm install` (precisa de internet para instalar `better-sqlite3`).
4. Execute `node server.js`.
5. Abra http://localhost:8000.

Para testar os produtos: http://localhost:8000/api/produtos.

## Banco

`loja.db` é criado automaticamente na primeira execução. `schema.sql` cria as tabelas; `insert.sql` insere os 100 produtos somente quando a tabela está vazia. Contas, sessões, pedidos, itens vendidos e estoque ficam em `loja.db`.

**Não substitua nem exclua seu `loja.db` antigo se quiser preservar os clientes e pedidos.** Faça backup antes de mudar os arquivos. Para recriar o banco do zero, pare o servidor e remova `loja.db` (isso apaga os dados existentes).

A pasta `imagens` deve continuar ao lado de `index.html`. Caso tenha imagens em `imagem/`, preserve também essa pasta.

## Limitações

O checkout registra pedidos e desconta estoque, mas **não processa pagamento real**. Não publique na internet sem implementar controles adicionais de segurança, administração e proteção de dados.

Se `npm install` falhar, envie a mensagem completa do erro. Instalar dependências npm pode ser bloqueado em computadores escolares.
