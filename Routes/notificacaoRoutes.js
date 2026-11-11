const express = require("express");
const router = express.Router();

const fb = require("../lib/firebase");

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

        const dados = await fb.ler(["notificacoes", req.session.uid]);

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

        const idNotificacao = req.params.id;

        if (!fb.idValido(idNotificacao)) {
            return res.status(400).json({
                erro: "Notificação inválida."
            });
        }

        // Só atualiza notificações que realmente existem para este usuário
        const existente = await fb.ler([
            "notificacoes",
            req.session.uid,
            idNotificacao
        ]);

        if (!existente) {
            return res.status(404).json({
                erro: "Notificação não encontrada."
            });
        }

        await fb.gravar(
            ["notificacoes", req.session.uid, idNotificacao, "lida"],
            true
        );

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
