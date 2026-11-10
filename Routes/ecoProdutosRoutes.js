
const express = require("express");
const router = express.Router();

const FIREBASE_URL =
    "https://ecotech-4344c-default-rtdb.firebaseio.com/";

// ========================================
// LISTAR PRODUTOS DO FIREBASE
// ========================================

router.get("/ecoProdutos", async (req, res) => {
    try {
        const resposta = await fetch(
            `${FIREBASE_URL}/produtos.json`
        );

        if (!resposta.ok) {
            throw new Error("Erro ao consultar o Firebase.");
        }

        const dados = await resposta.json();

        const produtos = dados
            ? Object.entries(dados)
                .filter(([id, dadosProduto]) => {
                    return dadosProduto.status === "aprovado";
                })
                .map(([id, dadosProduto]) => ({
                    ...dadosProduto,
                    id,
                    preco: Number(
                        dadosProduto.preco || 0
                    ).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })
                }))
                .reverse()
            : [];

        res.render("ecoProdutos", { produtos });

    } catch (erro) {
        console.error("Erro ao listar produtos:", erro);

        res.status(500).send(
            "Não foi possível carregar os produtos."
        );
    }
});

// ========================================
// DETALHES DO PRODUTO
// ========================================

router.get("/produto/:id", async (req, res) => {
    try {
        const resposta = await fetch(
            `${FIREBASE_URL}/produtos/${req.params.id}.json`
        );

        if (!resposta.ok) {
            throw new Error("Erro ao consultar o Firebase.");
        }

        const dados = await resposta.json();

        if (!dados) {
            return res.status(404).send(
                "Produto não encontrado."
            );
        }
        if (dados.status !== "aprovado") {
            return res.status(404).send(
                "Produto não encontrado."
            );
        }

        const produto = {
            ...dados,
            id: req.params.id,
            preco: Number(
                dados.preco || 0
            ).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })
        };

        res.render("detalhesProduto", { produto });

    } catch (erro) {
        console.error("Erro ao carregar detalhes:", erro);

        res.status(500).send(
            "Não foi possível carregar os detalhes do produto."
        );
    }
});


// ========================================
// ADICIONAR PRODUTO AO CARRINHO
// ========================================

router.post("/carrinho/adicionar/:id", async (req, res) => {
    try {
        // Verifica se o usuário está logado
        if (!req.session.uid) {
            return res.status(401).json({
                sucesso: false,
                mensagem: "Você precisa entrar na sua conta."
            });
        }

        const uid = req.session.uid;
        const idProduto = req.params.id;

        // Busca o produto no Firebase
        const respostaProduto = await fetch(
            `${FIREBASE_URL}/produtos/${encodeURIComponent(idProduto)}.json`
        );

        if (!respostaProduto.ok) {
            throw new Error("Erro ao consultar produto.");
        }

        const produto = await respostaProduto.json();

        // Verifica se o produto existe e está aprovado
        if (!produto || produto.status !== "aprovado") {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Produto não encontrado ou indisponível."
            });
        }

        // Caminho do carrinho específico do usuário
        const caminhoCarrinho =
            `${FIREBASE_URL}/carrinhos/${encodeURIComponent(uid)}/${encodeURIComponent(idProduto)}.json`;

        // Consulta se o produto já está no carrinho
        const respostaCarrinho = await fetch(caminhoCarrinho);

        if (!respostaCarrinho.ok) {
            throw new Error("Erro ao consultar carrinho.");
        }

        const itemExistente = await respostaCarrinho.json();

        // Define a quantidade
        const quantidade = itemExistente
            ? Number(itemExistente.quantidade || 1) + 1
            : 1;

        // Salva no Firebase
        const respostaSalvar = await fetch(caminhoCarrinho, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                produtoId: idProduto,
                quantidade: quantidade,
                adicionadoEm: new Date().toISOString()
            })
        });

        if (!respostaSalvar.ok) {
            throw new Error("Erro ao salvar produto no carrinho.");
        }

        return res.json({
            sucesso: true,
            mensagem: "Produto adicionado ao carrinho!"
        });

    } catch (erro) {
        console.error("Erro ao adicionar ao carrinho:", erro);

        return res.status(500).json({
            sucesso: false,
            mensagem: "Não foi possível adicionar o produto ao carrinho."
        });
    }
});


// ========================================
// VISUALIZAR CARRINHO
// ========================================

router.get("/carrinho", async (req, res) => {
    try {
        if (!req.session.uid) {
            return res.redirect("/login");
        }

        const uid = encodeURIComponent(req.session.uid);

        const respostaCarrinho = await fetch(
            `${FIREBASE_URL}/carrinhos/${uid}.json`
        );

        if (!respostaCarrinho.ok) {
            throw new Error("Erro ao consultar carrinho.");
        }

        const dadosCarrinho = await respostaCarrinho.json();

        const produtos = [];

        if (dadosCarrinho) {
            for (const [idProduto, item] of Object.entries(dadosCarrinho)) {
                const respostaProduto = await fetch(
                    `${FIREBASE_URL}/produtos/${encodeURIComponent(idProduto)}.json`
                );

                if (!respostaProduto.ok) {
                    throw new Error("Erro ao consultar produto.");
                }

                const produto = await respostaProduto.json();

                if (produto && produto.status === "aprovado") {
                    const quantidade = Number(item.quantidade) || 1;
                    const preco = Number(produto.preco) || 0;

                    produtos.push({
                        id: idProduto,
                        nome: produto.nome,
                        imagem: produto.imagens && produto.imagens.length > 0
                            ? produto.imagens[0]
                            : "/img/eletronico-padrao.png",
                        preco,
                        precoFormatado: preco.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        }),
                        quantidade,
                        subtotal: preco * quantidade
                    });
                }
            }
        }

        const total = produtos.reduce(
            (soma, produto) => soma + produto.subtotal,
            0
        );

        res.render("carrinho", {
            produtos,
            total: total.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })
        });

    } catch (erro) {
        console.error("Erro ao carregar carrinho:", erro);
        res.status(500).send("Não foi possível carregar seu carrinho.");
    }
});

router.delete("/carrinho/remover/:id", async (req, res) => {
    try {
        if (!req.session.uid) {
            return res.status(401).json({
                sucesso: false,
                mensagem: "Você precisa entrar na sua conta."
            });
        }

        const uid = encodeURIComponent(req.session.uid);
        const idProduto = encodeURIComponent(req.params.id);

        const resposta = await fetch(
            `${FIREBASE_URL}carrinhos/${uid}/${idProduto}.json`,
            { method: "DELETE" }
        );

        if (!resposta.ok) {
            throw new Error("Erro ao remover produto do carrinho.");
        }

        return res.json({
            sucesso: true,
            mensagem: "Produto removido do carrinho!"
        });

    } catch (erro) {
        console.error("Erro ao remover produto:", erro);

        return res.status(500).json({
            sucesso: false,
            mensagem: "Não foi possível remover o produto."
        });
    }
});

module.exports = router;
