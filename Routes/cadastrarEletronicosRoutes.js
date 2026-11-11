const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const fb = require("../lib/firebase");

const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024; // 5 MB

// Recebe a imagem temporariamente na memória
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: TAMANHO_MAXIMO_FOTO
    },
    fileFilter: (req, file, cb) => {
        const tiposPermitidos = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (tiposPermitidos.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Formato inválido. Use JPG, PNG ou WebP."));
        }
    }
});

// Executa o upload e responde aos erros do multer
// (eles acontecem antes da rota, por isso precisam ser tratados aqui)
function receberFoto(req, res, next) {
    upload.single("foto")(req, res, (erro) => {
        if (!erro) {
            return next();
        }

        if (erro instanceof multer.MulterError) {
            if (erro.code === "LIMIT_FILE_SIZE") {
                return res.status(400).send(
                    "A imagem deve ter no máximo 5 MB."
                );
            }

            return res.status(400).send("Não foi possível enviar a imagem.");
        }

        // Erro do filtro de formato
        return res.status(400).send(erro.message);
    });
}

// Envia a imagem armazenada na memória para o Cloudinary
function enviarImagem(buffer) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "ecotech/produtos",
                resource_type: "image"
            },
            (erro, resultado) => {
                if (erro) {
                    return reject(erro);
                }

                resolve(resultado);
            }
        );

        stream.end(buffer);
    });
}

// Garante que o campo seja texto e limita o tamanho
function texto(valor, limite = 100) {
    return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

function temChave(objeto, chave) {
    return typeof chave === "string" && Object.hasOwn(objeto, chave);
}

// Exige login (e bloqueia o administrador)
function exigirLogin(req, res, next) {
    if (!req.session.uid) return res.redirect("/login");
    if (req.session.tipo === "admin") return res.redirect("/admin");
    next();
}

// Exibe a página de cadastro
router.get("/cadastrarEletronicos", exigirLogin, (req, res) => {
    res.render("usuario/cadastrarEletronicos");
});

router.get("/cadastrar-eletro", exigirLogin, (req, res) => {
    res.render("usuario/cadastrarEletronicos");
});

const nomesProdutos = {
    celular: "Celular / Smartphone",
    computador: "Computador / Notebook",
    desktop: "Computador de mesa",
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

// Cadastra o eletrônico e sua imagem
router.post(
    "/cadastrarEletronicos",
    exigirLogin,
    receberFoto,
    async (req, res) => {
        let resultadoImagem = null;

        try {
            const {
                produto,
                funcionamento,
                problema,
                descricao,
                preco
            } = req.body;

            if (
                !temChave(nomesProdutos, produto) ||
                !temChave(nomesEstados, funcionamento) ||
                typeof problema !== "string" ||
                !problema.trim() ||
                problema.length > 300 ||
                (descricao != null &&
                    (typeof descricao !== "string" ||
                        descricao.length > 500)) ||
                typeof preco !== "string" ||
                preco.trim() === "" ||
                !Number.isFinite(Number(preco)) ||
                Number(preco) <= 0
            ) {
                return res.status(400).send(
                    "Confira os campos do formulário."
                );
            }

            if (!req.file) {
                return res.status(400).send(
                    "Selecione uma foto para o eletrônico."
                );
            }

            // Faz upload da foto
            resultadoImagem = await enviarImagem(req.file.buffer);

            // Dados do produto
            const novoProduto = {
                nome: nomesProdutos[produto],
                categoria: produto,

                marca: texto(req.body.marca),
                modelo: texto(req.body.modelo),
                armazenamento: texto(req.body.armazenamento),
                ram: texto(req.body.ram),
                tamanhoTela: texto(req.body.tamanhoTela),

                funcionamento,
                estado: nomesEstados[funcionamento],
                problema: problema.trim(),
                descricaoCompleta: descricao?.trim() || "",
                preco: Number(preco),
                imagens: [resultadoImagem.secure_url],
                imagemPublicId: resultadoImagem.public_id,
                criadoEm: new Date().toISOString(),

                // Identificação de quem cadastrou
                usuarioId: req.session.uid,

                // Controle de aprovação administrativa
                status: "pendente"
            };

            // Salva o produto no Firebase Realtime Database
            await fb.criar(["produtos"], novoProduto);

            return res.redirect("/ecoProdutos");

        } catch (erro) {
            console.error("ERRO AO CADASTRAR ELETRÔNICO:", erro.message);

            // Se a foto já subiu mas o produto não foi salvo, remove a foto
            if (resultadoImagem && resultadoImagem.public_id) {
                cloudinary.uploader
                    .destroy(resultadoImagem.public_id, {
                        resource_type: "image"
                    })
                    .catch(() => {});
            }

            return res.status(500).send(
                "Não foi possível cadastrar o eletrônico. Tente novamente."
            );
        }
    }
);

module.exports = router;
