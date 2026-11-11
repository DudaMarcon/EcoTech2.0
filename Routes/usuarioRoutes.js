const express = require("express");
const router = express.Router();

const fb = require("../lib/firebase");
const { hashSenha, verificarSenha, estaProtegida } = require("../lib/senha");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENHA_MIN = 6;
const SENHA_MAX = 200;

let avisouIndice = false;

// ========================================
// BUSCA DE USUÁRIOS POR E-MAIL
// ========================================

// Retorna todos os usuários com o e-mail informado (normalmente 0 ou 1).
// Usa consulta indexada; se o índice não existir no Firebase, recorre a uma
// leitura completa da tabela (mais lenta).
async function buscarUsuariosPorEmail(emailDigitado) {
    const variantes = [
        ...new Set([emailDigitado, emailDigitado.toLowerCase()])
    ];

    const encontrados = new Map();

    try {
        for (const variante of variantes) {
            const dados = await fb.consultarPorCampo(
                ["usuarios"],
                "email",
                variante
            );

            if (dados) {
                for (const [id, usuario] of Object.entries(dados)) {
                    encontrados.set(id, usuario);
                }
            }
        }
    } catch (erro) {
        if (erro.status !== 400) {
            throw erro;
        }

        if (!avisouIndice) {
            avisouIndice = true;
            console.warn(
                'Adicione ".indexOn": ["email"] em "usuarios" nas regras do ' +
                "Firebase para acelerar o login (veja firebase.rules.json)."
            );
        }

        const todos = await fb.ler(["usuarios"]);

        if (todos) {
            for (const [id, usuario] of Object.entries(todos)) {
                if (usuario && variantes.includes(usuario.email)) {
                    encontrados.set(id, usuario);
                }
            }
        }
    }

    return [...encontrados].map(([id, usuario]) => ({
        ...usuario,
        uid: id
    }));
}

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
    const email =
        typeof req.body.email === "string" ? req.body.email.trim() : "";
    const senha =
        typeof req.body.senha === "string" ? req.body.senha : "";

    const credenciaisInvalidas = () =>
        res.render("usuario/login", {
            erro: "E-mail ou senha incorretos"
        });

    if (!email || !senha || senha.length > SENHA_MAX) {
        return credenciaisInvalidas();
    }

    try {
        const candidatos = await buscarUsuariosPorEmail(email);

        let usuarioEncontrado = null;

        for (const candidato of candidatos) {
            if (await verificarSenha(senha, candidato.senha)) {
                usuarioEncontrado = candidato;
                break;
            }
        }

        if (!usuarioEncontrado) {
            return credenciaisInvalidas();
        }

        // Converte senhas antigas (texto puro) para hash
        if (!estaProtegida(usuarioEncontrado.senha)) {
            try {
                await fb.atualizar(["usuarios", usuarioEncontrado.uid], {
                    senha: await hashSenha(senha)
                });
            } catch (erro) {
                console.error(
                    "Não foi possível atualizar a senha para hash:",
                    erro.message
                );
            }
        }

        // Cria uma sessão nova (evita fixação de sessão)
        req.session.regenerate((erroSessao) => {
            if (erroSessao) {
                console.error(erroSessao);

                return res.render("usuario/login", {
                    erro: "Erro ao tentar fazer login. Tente novamente."
                });
            }

            const tipo =
                usuarioEncontrado.tipo === "admin" ? "admin" : "usuario";

            req.session.nome = usuarioEncontrado.nome;
            req.session.uid = usuarioEncontrado.uid;
            req.session.tipo = tipo;

            req.session.save(() => {
                res.redirect(tipo === "admin" ? "/admin" : "/usuario/dashboard");
            });
        });

    } catch (erro) {
        console.error("Erro no login:", erro.message);

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
    const nome =
        typeof req.body.nome === "string" ? req.body.nome.trim() : "";
    const email =
        typeof req.body.email === "string"
            ? req.body.email.trim().toLowerCase()
            : "";
    const senha =
        typeof req.body.senha === "string" ? req.body.senha : "";

    const recusar = (mensagem) =>
        res.status(400).render("usuario/cadastro", { erro: mensagem });

    if (nome.length < 2 || nome.length > 80) {
        return recusar("Informe seu nome completo (de 2 a 80 caracteres).");
    }

    if (email.length > 254 || !EMAIL_REGEX.test(email)) {
        return recusar("Informe um e-mail válido.");
    }

    if (senha.length < SENHA_MIN || senha.length > SENHA_MAX) {
        return recusar(
            `A senha deve ter de ${SENHA_MIN} a ${SENHA_MAX} caracteres.`
        );
    }

    try {
        const existentes = await buscarUsuariosPorEmail(email);

        if (existentes.length > 0) {
            return recusar("Este e-mail já está cadastrado.");
        }

        // Todo novo cadastro será usuário comum
        await fb.criar(["usuarios"], {
            nome,
            email,
            senha: await hashSenha(senha),
            tipo: "usuario",
            criadoEm: new Date().toISOString()
        });

        // Cadastro realizado
        res.redirect("/login");

    } catch (erro) {
        console.error("Erro no cadastro:", erro.message);

        res.render("usuario/cadastro", {
            erro: "Erro ao realizar o cadastro. Tente novamente."
        });
    }
});


// ========================================
// DASHBOARD DO USUÁRIO
// ========================================

async function buscarProdutosDoUsuario(uid) {
    const dados = await fb.ler(["produtos"]);

    if (!dados) return [];

    return Object.entries(dados)
        .filter(([id, produto]) => produto.usuarioId === uid)
        .map(([id, produto]) => ({ ...produto, id }))
        .sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));
}

function verificarUsuario(req, res, next) {
    if (!req.session.uid) {
        return res.redirect("/login");
    }

    if (req.session.tipo === "admin") {
        return res.redirect("/admin");
    }

    next();
}

// Dashboard do usuário
router.get("/usuario/dashboard", verificarUsuario, async (req, res) => {
    try {
        const produtos = await buscarProdutosDoUsuario(req.session.uid);

        res.render("usuario/dashboard", {
            nomeUsuario: req.session.nome || "Usuário",
            totalProdutos: produtos.length,
            produtosPendentes: produtos.filter(p => p.status === "pendente").length,
            produtosAprovados: produtos.filter(p => p.status === "aprovado").length,
            produtosRejeitados: produtos.filter(p => p.status === "rejeitado").length,
            produtosRecentes: produtos.slice(0, 4)
        });
    } catch (erro) {
        console.error("Erro ao carregar dashboard do usuário:", erro);
        res.status(500).send("Não foi possível carregar seu painel.");
    }
});

// Lista todos os eletrônicos cadastrados pela conta logada
router.get("/usuario/meus-eletro", verificarUsuario, async (req, res) => {
    try {
        const produtos = await buscarProdutosDoUsuario(req.session.uid);

        res.render("usuario/meus-eletro", {
            nomeUsuario: req.session.nome || "Usuário",
            produtos
        });
    } catch (erro) {
        console.error("Erro ao carregar eletrônicos do usuário:", erro);
        res.status(500).send("Não foi possível carregar seus eletrônicos.");
    }
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

        res.clearCookie("ecotech.sid");
        res.redirect("/");
    });
});


module.exports = router;
