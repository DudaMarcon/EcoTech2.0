const express = require("express");
const router = express.Router();

// Rota para exibir a página de cadastro de eletrônicos
router.get("/cadastrarEletronicos", (req, res) => {
    res.render("usuario/cadastrarEletronicos");
});


module.exports = router;