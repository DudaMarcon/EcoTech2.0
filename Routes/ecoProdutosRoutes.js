
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

module.exports = router;
