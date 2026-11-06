
const express = require("express");
const router = express.Router();

const FIREBASE_URL =
    "https://ecotech-4344c-default-rtdb.firebaseio.com/";

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

        if (!resposta.ok) {
            throw new Error("Erro ao consultar usuários.");
        }

        const usuarios = await resposta.json();

        let usuarioEncontrado = null;

        if (usuarios) {
            for (const id in usuarios) {
                if (
                    usuarios[id].email === email &&
                    usuarios[id].senha === senha
                ) {
                    usuarioEncontrado = {
                        ...usuarios[id],
                        uid: id
                    };

                    break;
                }
            }
        }

        // Verifica se o login está correto
        if (!usuarioEncontrado) {
            return res.render("usuario/login", {
                erro: "E-mail ou senha incorretos"
            });
        }

        // Salva os dados na sessão
        req.session.nome = usuarioEncontrado.nome;
        req.session.uid = usuarioEncontrado.uid;
        req.session.tipo = usuarioEncontrado.tipo || "usuario";

        // Redireciona conforme o tipo
        if (req.session.tipo === "admin") {
            return res.redirect("/admin");
        }

        return res.redirect("/usuario/dashboard");

    } catch (erro) {
        console.log(erro);

        return res.render("usuario/login", {
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

    // Todo novo cadastro será usuário comum
    const novoUsuario = {
        nome: nome,
        email: email,
        senha: senha,
        tipo: "usuario",
        criadoEm: new Date().toISOString()
    };

    try {
        const resposta = await fetch(
            `${FIREBASE_URL}/usuarios.json`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(novoUsuario)
            }
        );

        if (!resposta.ok) {
            throw new Error("Erro ao salvar usuário.");
        }

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
// CADASTRAR ELETRÔNICO
// ========================================

router.get("/cadastrar-eletro", (req, res) => {
    res.render("cadastrar-eletro");
});


// ========================================
// DASHBOARD DO USUÁRIO
// ========================================

router.get("/usuario/dashboard", (req, res) => {

    if (!req.session.uid) {
        return res.redirect("/login");
    }

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