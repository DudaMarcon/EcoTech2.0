
const express = require("express");
const router = express.Router();

const FIREBASE_URL =
    "https://ecotech-4344c-default-rtdb.firebaseio.com/";

// ========================================
// PROTEÇÃO ADMINISTRATIVA
// ========================================

function verificarAdmin(req, res, next) {
    if (
        !req.session.uid ||
        req.session.tipo !== "admin"
    ) {
        return res.status(403).send("Acesso não autorizado.");
    }

    next();
}

// ========================================
// DASHBOARD
// ========================================

router.get("/", verificarAdmin, async (req, res) => {
    try {
        const [respostaUsuarios, respostaProdutos] =
            await Promise.all([
                fetch(`${FIREBASE_URL}/usuarios.json`),
                fetch(`${FIREBASE_URL}/produtos.json`)
            ]);

        if (!respostaUsuarios.ok || !respostaProdutos.ok) {
            throw new Error("Erro ao consultar Firebase.");
        }

        const usuarios = await respostaUsuarios.json();
        const dadosProdutos = await respostaProdutos.json();

        const produtos = dadosProdutos
            ? Object.values(dadosProdutos)
            : [];

        const totalUsuarios = usuarios
            ? Object.values(usuarios).length
            : 0;

        const totalProdutos = produtos.length;

        const produtosPendentes = produtos.filter(
            produto => produto.status === "pendente"
        ).length;

        res.render("admin/dashboard", {
            nomeAdmin: req.session.nome || "Administrador",
            totalUsuarios,
            totalProdutos,
            produtosPendentes
        });

    } catch (erro) {
        console.error("Erro ao carregar dashboard:", erro);
        res.status(500).send(
            "Erro ao carregar painel administrativo."
        );
    }
});

// ========================================
// LISTAR PRODUTOS PARA APROVAÇÃO
// ========================================

router.get("/aprovar-produtos", verificarAdmin, async (req, res) => {
    try {
        const resposta = await fetch(
            `${FIREBASE_URL}/produtos.json`
        );

        if (!resposta.ok) {
            throw new Error("Erro ao consultar produtos.");
        }

        const dados = await resposta.json();

        const produtos = dados
            ? Object.entries(dados)
                .map(([id, produto]) => ({
                    ...produto,
                    id
                }))
                .filter(produto => produto.status === "pendente")
                .reverse()
            : [];

        res.render("admin/aprovarProdutos", {
            nomeAdmin: req.session.nome || "Administrador",
            produtos
        });

    } catch (erro) {
        console.error("Erro ao buscar produtos:", erro);
        res.status(500).send(
            "Não foi possível carregar os produtos."
        );
    }
});

// ========================================
// APROVAR PRODUTO
// ========================================

router.post("/aprovar-produto/:id", verificarAdmin, async (req, res) => {
    try {
        const resposta = await fetch(
            `${FIREBASE_URL}/produtos/${req.params.id}/status.json`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify("aprovado")
            }
        );

        if (!resposta.ok) {
            throw new Error("Erro ao aprovar produto.");
        }

        res.redirect("/admin/aprovar-produtos");

    } catch (erro) {
        console.error("Erro ao aprovar:", erro);
        res.status(500).send("Não foi possível aprovar o produto.");
    }
});

// ========================================
// REJEITAR PRODUTO
// ========================================

router.post("/rejeitar-produto/:id", verificarAdmin, async (req, res) => {
    try {
        const resposta = await fetch(
            `${FIREBASE_URL}/produtos/${req.params.id}/status.json`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify("rejeitado")
            }
        );

        if (!resposta.ok) {
            throw new Error("Erro ao rejeitar produto.");
        }

        res.redirect("/admin/aprovar-produtos");

    } catch (erro) {
        console.error("Erro ao rejeitar:", erro);
        res.status(500).send("Não foi possível rejeitar o produto.");
    }
});

module.exports = router;
