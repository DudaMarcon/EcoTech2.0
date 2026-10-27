const express = require("express");
const router = express.Router();

const FIREBASE_URL =
    "https://ecotech-4344c-default-rtdb.firebaseio.com/";

// Exibe a página de cadastro
router.get("/cadastrarEletronicos", (req, res) => {
    res.render("usuario/cadastrarEletronicos");
});

// Também permite acessar por esta URL
router.get("/cadastrar-eletro", (req, res) => {
    res.render("usuario/cadastrarEletronicos");
});

// Salva o eletrônico no Firebase
router.post("/cadastrarEletronicos", async (req, res) => {
    try {
        const {
            produto,
            funcionamento,
            problema,
            descricao,
            preco
        } = req.body;

        const nomesProdutos = {
            celular: "Celular / Smartphone",
            computador: "Computador / Notebook",
            tablet: "Tablet",
            televisao: "Televisão / Monitor",
            perifericos: "Teclado / Mouse / Periféricos",
            console: "Console de videogame",
            impressora: "Impressora",
            outro: "Outro eletrônico"
        };

        const nomesEstados = {
            funcionando: "Funcionando normalmente",
            defeito: "Com defeito",
            danificado: "Danificado",
            nao_testado: "Não testado"
        };

        if (
            !nomesProdutos[produto] ||
            !nomesEstados[funcionamento] ||
            typeof problema !== "string" ||
            !problema.trim() ||
            problema.length > 300 ||
            (descricao != null &&
                (typeof descricao !== "string" ||
                 descricao.length > 500)) ||
            preco === undefined ||
            String(preco).trim() === "" ||
            !Number.isFinite(Number(preco)) ||
            Number(preco) <= 0
        ) {
            return res.status(400).send(
                "Confira os campos do formulário."
            );
        }

        const novoProduto = {
            nome: nomesProdutos[produto],
            categoria: produto,
            funcionamento: funcionamento,
            estado: nomesEstados[funcionamento],
            problema: problema.trim(),
            descricaoCompleta: descricao?.trim() || "",
            preco: Number(preco),
            imagens: ["/img/eletronico-padrao.png"],
            criadoEm: new Date().toISOString()
        };

        const resposta = await fetch(
            `${FIREBASE_URL}/produtos.json`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(novoProduto)
            }
        );

        if (!resposta.ok) {
            throw new Error("Falha ao salvar no Firebase.");
        }

        // Cadastro concluído: abre a página de venda
        return res.redirect("/ecoProdutos");

    } catch (erro) {
        console.error("Erro ao cadastrar eletrônico:", erro);

        return res.status(500).send(
            "Erro ao cadastrar eletrônico."
        );
    }
});

module.exports = router;