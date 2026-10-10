
const express = require('express');

const router = express.Router();
// Rota para verificar se o usuário está logado
router.get('/', (req, res) => {
    if (req.session.nome) {
        // Se o usuário estiver logado, redireciona para a página de cadastro de eletrônicos
        return res.redirect('/cadastrarEletronicos');
    } else {
        // Se o usuário não estiver logado, redireciona para a página de login
        return res.redirect('/login');
    }
});

module.exports = router;