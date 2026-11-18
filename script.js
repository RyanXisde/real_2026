'use strict';

const app = document.getElementById('app');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('menuOverlay');

const elementos = {
    menuToggle: document.getElementById('menuToggle'),
    menuClose: document.getElementById('menuClose'),
    cartButton: document.getElementById('btnIrCarrinho'),
    cadastroButton: document.getElementById('btnIrCadastro'),
    configButton: document.getElementById('btnIrConfig'),
    logo: document.getElementById('logoLink'),
    cartBadge: document.getElementById('cartCountBadge')
};

const categorias = {
    todos: 'Todos os Produtos',
    promocoes: 'Promoções & Descontos',
    canecas: 'Canecas',
    ac: 'Action Figures',
    quadros: 'Quadros',
    mangas: 'Mangás',
    ln: 'Light Novels',
    hq: 'Quadrinhos',
    games: 'Games',
    colecionaveis: 'Colecionáveis',
    roupas: 'Roupas',
    favoritos: 'Meus Favoritos'
};

let produtos = [];
let cliente = null;

let categoria = 'todos';
let tela = 'home';
let busca = '';

const ler = (chave, padrao) => {
    try {
        return JSON.parse(localStorage.getItem(chave)) ?? padrao;
    } catch {
        return padrao;
    }
};

let carrinho = ler('collector_carrinho', {});
let favoritos = ler('collector_favoritos', []);

const salvar = () => {
    localStorage.setItem(
        'collector_carrinho',
        JSON.stringify(carrinho)
    );

    localStorage.setItem(
        'collector_favoritos',
        JSON.stringify(favoritos)
    );
};

const moeda = valor =>
    Number(valor).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });

const esc = valor =>
    String(valor ?? '').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[caractere]);

const achar = id =>
    produtos.find(produto => produto.id === Number(id));

const imagem = produto =>
    produto.imagem
        ? encodeURI(produto.imagem).replace(/#/g, '%23')
        : 'sem-imagem.svg';

async function api(url, metodo = 'GET', dados) {
    const resposta = await fetch(url, {
        method: metodo,
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json'
        },
        body: dados === undefined
            ? undefined
            : JSON.stringify(dados)
    });

    const resultado = await resposta.json();

    if (!resposta.ok) {
        throw Error(resultado.erro || 'Erro no servidor');
    }

    return resultado;
}

async function atualizar() {
    const [resultadoProdutos, resultadoCliente] =
        await Promise.all([
            api('/api/produtos'),
            api('/api/me')
        ]);

    produtos = resultadoProdutos.produtos;
    cliente = resultadoCliente.cliente;

    render();
}

function aviso(mensagem, erro = false) {
    const elemento = document.getElementById('aviso');

    if (elemento) {
        elemento.textContent = mensagem;

        elemento.style.color = erro
            ? '#ff8d8d'
            : '#9af5ba';
    } else {
        alert(mensagem);
    }
}

function abrirMenu() {
    sidebar.classList.add('active');
    overlay.classList.add('active');
}

function fecharMenu() {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
}

function navegar(destino) {
    tela = destino;

    fecharMenu();
    render();

    window.scrollTo(0, 0);
}

function contador() {
    elementos.cartBadge.textContent =
        Object.values(carrinho).reduce(
            (total, quantidade) =>
                total + Number(quantidade),
            0
        );
}

function card(produto) {
    return `
        <article class="card">

            <img
                class="imagem_produto"
                src="${esc(imagem(produto))}"
                alt="${esc(produto.nome)}"
                loading="lazy"
                onerror="this.onerror=null;this.src='sem-imagem.svg'"
            >

            <h3>${esc(produto.nome)}</h3>

            <div style="padding:0 15px 12px">

                <strong style="color:#ff8c32">
                    ${moeda(produto.preco)}
                </strong>

                ${
                    produto.precoOriginal > produto.preco
                        ? `
                            <del style="color:#aaa">
                                ${moeda(produto.precoOriginal)}
                            </del>
                        `
                        : ''
                }

                <p style="font-size:.85rem;margin:8px 0;color:#a0a3c4">
                    Estoque: ${produto.estoque}
                </p>

            </div>

            <div style="display:flex;gap:8px;padding:0 12px 12px;margin-top:auto">

                <button
                    data-acao="comprar"
                    data-id="${produto.id}"
                    ${produto.estoque < 1 ? 'disabled' : ''}
                    style="margin:0;flex:1;width:auto"
                >
                    Adicionar 🛒
                </button>

                <button
                    data-acao="favoritar"
                    data-id="${produto.id}"
                    aria-label="Favoritar"
                    style="margin:0;width:48px;flex-shrink:0"
                >
                    ${favoritos.includes(produto.id) ? '❤️' : '♡'}
                </button>

            </div>

        </article>
    `;
}

function renderHome() {
    let itens = produtos.filter(produto => {

        if (categoria === 'todos') return true;

        if (categoria === 'promocoes') {
            return produto.precoOriginal > produto.preco;
        }

        if (categoria === 'favoritos') {
            return favoritos.includes(produto.id);
        }

        return produto.categoria === categoria;
    });

    if (busca) {
        itens = itens.filter(produto =>
            produto.nome.toLowerCase().includes(
                busca.toLowerCase()
            )
        );
    }

    app.innerHTML = `
        <section>

            <h1 style="margin-bottom:16px">
                ${categorias[categoria] || 'Produtos'}
            </h1>

            <input
                id="campoBusca"
                type="search"
                placeholder="Buscar produtos..."
                value="${esc(busca)}"
                style="width:100%;max-width:450px;padding:12px;border-radius:10px;margin-bottom:25px;background:#1c1a32;color:white;border:1px solid #6b3fc9"
            >

            <p style="margin-bottom:20px;color:#a0a3c4">
                ${itens.length} produto(s) encontrado(s)
                — carregados do banco SQLite
            </p>

            <div class="cards">
                ${
                    itens.length
                        ? itens.map(card).join('')
                        : '<p>Nenhum produto encontrado.</p>'
                }
            </div>

        </section>
    `;
}

// Mantenha aqui a função renderCarrinho()
// do seu código original.

// Mantenha aqui a função renderCadastro()
// do seu código original.

function renderConfig() {
    app.innerHTML = `
        <h1>⚙️ Configurações</h1>

        <p style="margin:20px 0">
            Produtos e pedidos são armazenados em
            <code>loja.db</code>.
            Para gerenciar seus dados, entre na sua conta.
        </p>

        <button class="btn" data-acao="conta">
            Abrir minha conta
        </button>
    `;
}

function renderSobre() {
    app.innerHTML = `
        <h1>ℹ️ Sobre Nós</h1>

        <p style="margin-top:20px">
            Collector's Hub — Mundo do Colecionador.
        </p>
    `;
}

// Mantenha aqui a função renderPedidos()
// do seu código original.

function render() {
    contador();

    switch (tela) {
        case 'home':
            renderHome();
            break;

        case 'carrinho':
            renderCarrinho();
            break;

        case 'cadastro':
            renderCadastro();
            break;

        case 'configuracoes':
            renderConfig();
            break;

        case 'pedidos':
            renderPedidos();
            break;

        default:
            renderSobre();
    }
}

elementos.menuToggle.addEventListener('click', abrirMenu);
elementos.menuClose.addEventListener('click', fecharMenu);

overlay.addEventListener('click', fecharMenu);

elementos.cartButton.addEventListener('click', () => {
    navegar('carrinho');
});

elementos.cadastroButton.addEventListener('click', () => {
    navegar('cadastro');
});

elementos.configButton.addEventListener('click', () => {
    navegar('configuracoes');
});

elementos.logo.addEventListener('click', evento => {
    evento.preventDefault();

    categoria = 'todos';
    busca = '';

    navegar('home');
});

app.addEventListener('input', evento => {
    if (evento.target.id !== 'campoBusca') return;

    const posicao = evento.target.selectionStart;

    busca = evento.target.value;

    renderHome();

    const campo = document.getElementById('campoBusca');

    campo.focus();
    campo.setSelectionRange(posicao, posicao);
});

app.innerHTML = `
    <p>Carregando produtos do banco de dados...</p>
`;

atualizar().catch(erro => {
    app.innerHTML = `
        <h1>Não foi possível conectar ao banco</h1>

        <p>${esc(erro.message)}</p>

        <p>
            Inicie o servidor com
            <code>node server.js</code>
            e abra
            <code>http://127.0.0.1:8000</code>.
            Não abra o HTML diretamente.
        </p>
    `;
});
