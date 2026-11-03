const express = require("express");
const router = express.Router();

// 1. Lista de produtos
const produtosLista = [
    {
        id: "1",
        nome: "Smartphone EcoTech X",
        preco: "1.299,00",
        descricaoCompleta: "Smartphone recondicionado com certificação de qualidade EcoTech.",
        imagens: ["/img/smartphone-recondicionado.jpg"],
        estado: "Excelente"
    },
    {
        id: "2",
        nome: "Notebook EcoTech Pro",
        preco: "2.499,00",
        descricaoCompleta: "Notebook recondicionado, testado e com garantia.",
        imagens: ["/img/notebook-recondicionado.jpg"],
        estado: "Bom"
    }
];

// 2. Rota que envia os dados para a view ecoProdutos.ejs
router.get("/ecoProdutos", (req, res) => {
    res.render("ecoProdutos", { produtos: produtosLista });
});

// 3. Rota dinâmica de detalhes
router.get("/produto/:id", (req, res) => {
    const produtoId = req.params.id;
    const produtoEncontrado = produtosLista.find(p => p.id === produtoId);

    if (!produtoEncontrado) {
        return res.status(404).send("Produto não encontrado.");
    }

    res.render("detalhesProduto", { produto: produtoEncontrado });
});

module.exports = router;