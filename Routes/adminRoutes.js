const express = require("express");
const router = express.Router();

const fb = require("../lib/firebase");
const cloudinary = require("../config/cloudinary");

// ========================================
// VERIFICAR ADMINISTRADOR
// ========================================

function verificarAdmin(req, res, next) {
    if (!req.session.uid || req.session.tipo !== "admin") {
        return res.status(403).send("Acesso não autorizado.");
    }

    next();
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

// Lê um nó do Firebase (caminho em lista de segmentos ou texto fixo)
function buscarFirebase(caminho) {
    return fb.ler(caminho);
}

async function atualizarFirebase(caminho, dados, metodo = "PUT") {
    if (metodo === "POST") return fb.criar(caminho, dados);
    if (metodo === "PATCH") return fb.atualizar(caminho, dados);

    return fb.gravar(caminho, dados);
}

// Descobre o public_id do Cloudinary a partir da URL da imagem
// (só aceita imagens da pasta ecotech/produtos)
function publicIdDaUrl(url) {
    if (typeof url !== "string") return null;

    const encontrado = url.match(
        /\/image\/upload\/(?:v\d+\/)?(ecotech\/produtos\/[A-Za-z0-9_-]+)\.[A-Za-z0-9]+(?:\?.*)?$/
    );

    return encontrado ? encontrado[1] : null;
}

// Remove as imagens do produto no Cloudinary (sem interromper a exclusão)
async function apagarImagensDoProduto(produto) {
    const ids = new Set();

    if (
        typeof produto.imagemPublicId === "string" &&
        produto.imagemPublicId.startsWith("ecotech/produtos/")
    ) {
        ids.add(produto.imagemPublicId);
    }

    for (const url of Array.isArray(produto.imagens) ? produto.imagens : []) {
        const id = publicIdDaUrl(url);

        if (id) ids.add(id);
    }

    const resultados = await Promise.allSettled(
        [...ids].map((id) =>
            cloudinary.uploader.destroy(id, { resource_type: "image" })
        )
    );

    resultados.forEach((resultado) => {
        if (resultado.status === "rejected") {
            console.error(
                "Não foi possível remover a imagem do Cloudinary:",
                resultado.reason && resultado.reason.message
            );
        }
    });
}

// Registra atividades sem interromper a aprovação caso o histórico falhe.
async function registrarAtividade(atividade) {
    try {
        await atualizarFirebase("atividades", {
            ...atividade,
            criadoEm: new Date().toISOString()
        }, "POST");
    } catch (erro) {
        console.error("Erro ao registrar atividade:", erro.message);
    }
}

// Organiza os produtos do Firebase.
function organizarProdutos(dados) {
    return dados
        ? Object.entries(dados).map(([id, produto]) => ({
            ...produto,
            id
        })).reverse()
        : [];
}

// ========================================
// DASHBOARD
// ========================================

router.get("/", verificarAdmin, async (req, res) => {
    try {
        const [usuarios, dadosProdutos, dadosAtividades] =
            await Promise.all([
                buscarFirebase("usuarios"),
                buscarFirebase("produtos"),
                buscarFirebase("atividades")
            ]);

        const produtos = organizarProdutos(dadosProdutos);

        const atividades = [];

        // Atividades registradas manualmente no Firebase.
        if (dadosAtividades) {
            Object.entries(dadosAtividades).forEach(([id, item]) => {
                atividades.push({
                    ...item,
                    id
                });
            });
        }

        // Cadastros de produtos antigos e novos.
        produtos.forEach(produto => {
            if (produto.criadoEm) {
                atividades.push({
                    tipo: "produto",
                    titulo: "Novo produto cadastrado",
                    descricao: `${produto.nome || "Produto"} foi enviado para análise.`,
                    criadoEm: produto.criadoEm
                });
            }
        });

        // Usuários que possuam data de cadastro.
        if (usuarios) {
            Object.entries(usuarios).forEach(([id, usuario]) => {
                const data = usuario.criadoEm || usuario.dataCadastro;

                if (data) {
                    atividades.push({
                        tipo: "usuario",
                        titulo: "Novo usuário cadastrado",
                        descricao: `${usuario.nome || "Novo usuário"} criou uma conta.`,
                        criadoEm: data
                    });
                }
            });
        }

        // Ordena da atividade mais recente para a mais antiga.
        atividades.sort((a, b) =>
            new Date(b.criadoEm) - new Date(a.criadoEm)
        );

        res.render("admin/dashboard", {
            nomeAdmin: req.session.nome || "Administrador",
            totalUsuarios: usuarios ? Object.keys(usuarios).length : 0,
            totalProdutos: produtos.length,
            produtosPendentes: produtos.filter(
                produto => produto.status === "pendente"
            ).length,
            atividadesRecentes: atividades.slice(0, 8)
        });

    } catch (erro) {
        console.error("Erro ao carregar dashboard:", erro);

        res.status(500).send(
            "Erro ao carregar painel administrativo."
        );
    }
});

// ========================================
// APROVAR PRODUTOS
// ========================================

router.get("/aprovar-produtos", verificarAdmin, async (req, res) => {
    try {
        const dados = await buscarFirebase("produtos");

        const produtos = organizarProdutos(dados)
            .filter(produto => produto.status === "pendente");

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
        const idProduto = req.params.id;

        if (!fb.idValido(idProduto)) {
            return res.status(400).send("Produto inválido.");
        }

        const produto = await buscarFirebase(["produtos", idProduto]);

        if (!produto || produto.status !== "pendente") {
            return res.redirect("/admin/aprovar-produtos");
        }

        if (!produto.usuarioId) {
            throw new Error("Produto sem identificação do usuário.");
        }

        await atualizarFirebase(["produtos", idProduto, "status"], "aprovado");

        const notificacao = {
            titulo: "Produto aprovado!",
            mensagem: `Seu produto ${produto.nome || "eletrônico"} foi aprovado pela equipe EcoTech.`,
            tipo: "aprovado",
            produtoId: idProduto,
            lida: false,
            criadoEm: new Date().toISOString()
        };

        await atualizarFirebase(
            ["notificacoes", produto.usuarioId],
            notificacao,
            "POST"
        );

        await registrarAtividade({
            tipo: "aprovacao",
            titulo: "Produto aprovado",
            descricao: `${produto.nome || "Produto"} foi aprovado pelo administrador.`
        });

        res.redirect("/admin/aprovar-produtos");

    } catch (erro) {
        console.error("Erro ao aprovar produto:", erro);

        res.status(500).send(
            "Não foi possível aprovar o produto."
        );
    }
});

// ========================================
// REJEITAR PRODUTO
// ========================================

router.post("/rejeitar-produto/:id", verificarAdmin, async (req, res) => {
    try {
        const idProduto = req.params.id;

        if (!fb.idValido(idProduto)) {
            return res.status(400).send("Produto inválido.");
        }

        const produto = await buscarFirebase(["produtos", idProduto]);

        if (!produto || produto.status !== "pendente") {
            return res.redirect("/admin/aprovar-produtos");
        }

        if (!produto.usuarioId) {
            throw new Error("Produto sem identificação do usuário.");
        }

        await atualizarFirebase(["produtos", idProduto, "status"], "rejeitado");

        const notificacao = {
            titulo: "Produto não aprovado",
            mensagem: "Infelizmente, seu produto não atende aos requisitos para ser vendido como um EcoProduto. Mas você ainda pode fazer parte do movimento EcoTech! Encontre um ecoponto próximo e descubra onde descartá-lo corretamente para que possamos dar a ele o destino adequado.",
            tipo: "rejeitado",
            produtoId: idProduto,
            lida: false,
            criadoEm: new Date().toISOString()
        };

        await atualizarFirebase(
            ["notificacoes", produto.usuarioId],
            notificacao,
            "POST"
        );

        await registrarAtividade({
            tipo: "rejeicao",
            titulo: "Produto rejeitado",
            descricao: `${produto.nome || "Produto"} não foi aprovado pelo administrador.`
        });

        res.redirect("/admin/aprovar-produtos");

    } catch (erro) {
        console.error("Erro ao rejeitar produto:", erro);

        res.status(500).send(
            "Não foi possível rejeitar o produto."
        );
    }
});

// ========================================
// USUÁRIOS
// ========================================

router.get("/usuarios", verificarAdmin, async (req, res) => {
    try {
        const dados = await buscarFirebase("usuarios");

        const usuarios = dados
            ? Object.entries(dados).map(([id, usuario]) => {
                // A senha nunca é enviada para a página
                const { senha, ...dadosPublicos } = usuario;

                return {
                    ...dadosPublicos,
                    id,
                    criadoEm: usuario.criadoEm || usuario.dataCadastro || null
                };
            }).reverse()
            : [];

        res.render("admin/usuarios", {
            nomeAdmin: req.session.nome || "Administrador",
            usuarios
        });

    } catch (erro) {
        console.error("Erro ao carregar usuários:", erro);

        res.status(500).send(
            "Não foi possível carregar os usuários."
        );
    }
});

// ========================================
// TODOS OS PRODUTOS
// ========================================

router.get("/produtos", verificarAdmin, async (req, res) => {
    try {
        const dados = await buscarFirebase("produtos");

        const produtos = organizarProdutos(dados);

        res.render("admin/produtos", {
            nomeAdmin: req.session.nome || "Administrador",
            produtos
        });

    } catch (erro) {
        console.error("Erro ao carregar produtos:", erro);

        res.status(500).send(
            "Não foi possível carregar os produtos."
        );
    }
});

// ========================================
// ELETRÔNICOS
// ========================================

router.get("/eletronicos", verificarAdmin, async (req, res) => {
    try {
        const dados = await buscarFirebase("produtos");

        const produtos = organizarProdutos(dados);

        const eletronicos = produtos.filter(produto =>
            Boolean(produto.categoria)
        );

        res.render("admin/eletronicos", {
            nomeAdmin: req.session.nome || "Administrador",
            eletronicos
        });

    } catch (erro) {
        console.error("Erro ao carregar eletrônicos:", erro);

        res.status(500).send(
            "Não foi possível carregar os eletrônicos."
        );
    }
});

// EXCLUIR PRODUTO
router.post("/excluir-produto/:id", verificarAdmin, async (req, res) => {
    try {
        const idProduto = req.params.id;

        if (!fb.idValido(idProduto)) {
            return res.status(400).send("Produto inválido.");
        }

        // Busca o produto antes de excluir
        const produto = await buscarFirebase(["produtos", idProduto]);

        if (!produto) {
            return res.redirect("/admin/produtos");
        }

        // Exclui do Firebase
        await fb.remover(["produtos", idProduto]);

        // Remove a foto do Cloudinary
        await apagarImagensDoProduto(produto);

        // Registra a atividade no painel
        await registrarAtividade({
            tipo: "exclusao",
            titulo: "Produto excluído",
            descricao: `${produto.nome || "Produto"} foi excluído do sistema.`,
            data: new Date().toISOString()
        });

        res.redirect("/admin/produtos");

    } catch (erro) {
        console.error("Erro ao excluir produto:", erro);
        res.status(500).send("Erro ao excluir produto.");
    }
});

module.exports = router;