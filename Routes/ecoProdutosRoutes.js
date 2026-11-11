const express = require("express");
const router = express.Router();

const fb = require("../lib/firebase");

const IMAGEM_PADRAO = "/img/eletronico-padrao.svg";

function formatarPreco(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// ========================================
// LISTAR PRODUTOS DO FIREBASE
// ========================================

router.get("/ecoProdutos", async (req, res) => {
    try {
        const dados = await fb.ler(["produtos"]);

        const produtos = dados
            ? Object.entries(dados)
                .filter(([id, dadosProduto]) => {
                    return dadosProduto.status === "aprovado";
                })
                .map(([id, dadosProduto]) => ({
                    ...dadosProduto,
                    id,
                    preco: formatarPreco(dadosProduto.preco)
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
        if (!fb.idValido(req.params.id)) {
            return res.status(404).send("Produto não encontrado.");
        }

        const dados = await fb.ler(["produtos", req.params.id]);

        if (!dados || dados.status !== "aprovado") {
            return res.status(404).send(
                "Produto não encontrado."
            );
        }

        const produto = {
            ...dados,
            id: req.params.id,
            preco: formatarPreco(dados.preco)
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

        if (!fb.idValido(idProduto)) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Produto não encontrado ou indisponível."
            });
        }

        // Busca o produto no Firebase
        const produto = await fb.ler(["produtos", idProduto]);

        // Verifica se o produto existe e está aprovado
        if (!produto || produto.status !== "aprovado") {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Produto não encontrado ou indisponível."
            });
        }

        // Cada eletrônico é uma peça única: o dono não pode comprá-lo
        if (produto.usuarioId === uid) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Você não pode adicionar o seu próprio eletrônico ao carrinho."
            });
        }

        // Cada eletrônico é uma peça única: não há como levar duas unidades
        const itemExistente = await fb.ler(["carrinhos", uid, idProduto]);

        if (itemExistente) {
            return res.status(409).json({
                sucesso: false,
                mensagem: "Este produto já está no seu carrinho."
            });
        }

        await fb.gravar(["carrinhos", uid, idProduto], {
            produtoId: idProduto,
            quantidade: 1,
            adicionadoEm: new Date().toISOString()
        });

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

        const uid = req.session.uid;

        const dadosCarrinho = await fb.ler(["carrinhos", uid]);

        const itens = dadosCarrinho
            ? Object.keys(dadosCarrinho).filter(fb.idValido)
            : [];

        // Busca todos os produtos do carrinho ao mesmo tempo
        const encontrados = await Promise.all(
            itens.map(async (idProduto) => ({
                idProduto,
                produto: await fb.ler(["produtos", idProduto])
            }))
        );

        const produtos = [];
        const removidos = [];

        for (const { idProduto, produto } of encontrados) {
            // Produto excluído: limpa o item do carrinho
            if (!produto) {
                removidos.push(idProduto);
                continue;
            }

            if (produto.status !== "aprovado") {
                continue;
            }

            const preco = Number(produto.preco) || 0;

            produtos.push({
                id: idProduto,
                nome: produto.nome,
                imagem: produto.imagens && produto.imagens.length > 0
                    ? produto.imagens[0]
                    : IMAGEM_PADRAO,
                preco,
                precoFormatado: formatarPreco(preco),
                quantidade: 1,
                subtotal: preco
            });
        }

        if (removidos.length > 0) {
            await Promise.allSettled(
                removidos.map((id) => fb.remover(["carrinhos", uid, id]))
            );
        }

        const total = produtos.reduce(
            (soma, produto) => soma + produto.subtotal,
            0
        );

        res.render("carrinho", {
            produtos,
            total: formatarPreco(total)
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

        if (!fb.idValido(req.params.id)) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Produto inválido."
            });
        }

        await fb.remover(["carrinhos", req.session.uid, req.params.id]);

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
