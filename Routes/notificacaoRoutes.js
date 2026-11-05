const express = require("express");
const router = express.Router();

const FIREBASE_URL =
    "https://ecotech-4344c-default-rtdb.firebaseio.com/";

// ========================================
// BUSCAR NOTIFICAÇÕES DO USUÁRIO
// ========================================

router.get("/api/notificacoes", async (req, res) => {
    try {
        if (!req.session.uid) {
            return res.status(401).json({
                erro: "Usuário não está logado."
            });
        }

        const resposta = await fetch(
            `${FIREBASE_URL}/notificacoes/${req.session.uid}.json`
        );

        if (!resposta.ok) {
            throw new Error("Erro ao consultar notificações.");
        }

        const dados = await resposta.json();

        const notificacoes = dados
            ? Object.entries(dados)
                .map(([id, notificacao]) => ({
                    id,
                    ...notificacao
                }))
               .sort((a, b) =>
    new Date(b.criadoEm) - new Date(a.criadoEm)
)
            : [];

        res.json(notificacoes);

    } catch (erro) {
        console.error("Erro ao buscar notificações:", erro);

        res.status(500).json({
            erro: "Não foi possível carregar as notificações."
        });
    }
});


// ========================================
// MARCAR NOTIFICAÇÃO COMO LIDA
// ========================================

router.post("/api/notificacoes/:id/lida", async (req, res) => {
    try {
        if (!req.session.uid) {
            return res.status(401).json({
                erro: "Usuário não está logado."
            });
        }

        const resposta = await fetch(
            `${FIREBASE_URL}/notificacoes/${req.session.uid}/${req.params.id}/lida.json`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(true)
            }
        );

        if (!resposta.ok) {
            throw new Error("Erro ao atualizar notificação.");
        }

        res.json({
            sucesso: true
        });

    } catch (erro) {
        console.error("Erro ao marcar notificação:", erro);

        res.status(500).json({
            erro: "Não foi possível atualizar a notificação."
        });
    }
});

module.exports = router;