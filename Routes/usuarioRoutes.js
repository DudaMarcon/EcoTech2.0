const express = require("express");
const router = express.Router();

const FIREBASE_URL = "https://ecotech-4344c-default-rtdb.firebaseio.com/";

// ========================================
// LOGIN
// ========================================

// Tela de login
router.get("/login", (req, res) => {
    res.render("usuario/login", {
        erro: null
    });
});

// Recebe o login
router.post("/login", async (req, res) => {
    const { email, senha } = req.body;

    try {
        const resposta = await fetch(
            `${FIREBASE_URL}/usuarios.json`
        );

        const usuarios = await resposta.json();

        let usuarioEncontrado = null;

        if (usuarios) {
            for (const id in usuarios) {
                if (
                    usuarios[id].email === email &&
                    usuarios[id].senha === senha
                ) {
                    usuarioEncontrado = usuarios[id];
                    break;
                }
            }
        }

        // Login incorreto
        if (!usuarioEncontrado) {
            return res.render("usuario/login", {
                erro: "E-mail ou senha incorretos"
            });
        }

        // Salva o nome na sessão
        req.session.nome = usuarioEncontrado.nome;

        // Login correto
        res.redirect("/usuario/dashboard");

    } catch (erro) {
        console.log(erro);

        res.render("usuario/login", {
            erro: "Erro ao tentar fazer login. Tente novamente."
        });
    }
});


// ========================================
// CADASTRO
// ========================================

// Tela de cadastro
router.get("/cadastro", (req, res) => {
    res.render("usuario/cadastro", {
        erro: null
    });
});

// Recebe o cadastro
router.post("/cadastro", async (req, res) => {
    const { nome, email, senha } = req.body;

    const novoUsuario = {
        nome: nome,
        email: email,
        senha: senha
    };

    try {
        await fetch(
            `${FIREBASE_URL}/usuarios.json`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(novoUsuario)
            }
        );

        // Cadastro realizado
        res.redirect("/login");

    } catch (erro) {
        console.log(erro);

        res.render("usuario/cadastro", {
            erro: "Erro ao realizar o cadastro. Tente novamente."
        });
    }
});


// ========================================
// DASHBOARD
// ========================================

router.get("/usuario/dashboard", (req, res) => {
    res.render("usuario/dashboard");
});


// ========================================
// LOGOUT
// ========================================

router.get("/logout", (req, res) => {
    req.session.destroy((erro) => {

        if (erro) {
            console.log(erro);
            return res.redirect("/");
        }

        res.redirect("/");
    });
});


module.exports = router;