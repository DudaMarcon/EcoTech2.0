
const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("../config/cloudinary");

const FIREBASE_URL =
    "https://ecotech-4344c-default-rtdb.firebaseio.com/";

// Recebe a imagem temporariamente na memória
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB
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

// Exibe a página de cadastro
router.get("/cadastrarEletronicos", (req, res) => {
    res.render("usuario/cadastrarEletronicos");
});

router.get("/cadastrar-eletro", (req, res) => {
    res.render("usuario/cadastrarEletronicos");
});

// Cadastra o eletrônico e sua imagem
router.post(
    "/cadastrarEletronicos",
    upload.single("foto"),
    async (req, res) => {
        try {
            const {
                produto,
                funcionamento,
                problema,
                descricao,
                preco
            } = req.body;

            // Novos campos do eletrônico
            const marcaProduto =
                req.body.marca || req.body.marcaManual || "";

            const modeloProduto =
                req.body.modelo || req.body.modeloManual || "";

            const armazenamento =
                req.body.armazenamento || "";

            const memoriaRam =
                req.body.ram || "";

            const tamanhoTela =
                req.body.tamanhoTela || "";

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

            if (!req.file) {
                return res.status(400).send(
                    "Selecione uma foto para o eletrônico."
                );
            }

            // Faz upload da foto
            const resultadoImagem = await enviarImagem(req.file.buffer);

            // Dados do produto
            const novoProduto = {
                nome: nomesProdutos[produto],
                categoria: produto,

                marca: marcaProduto,
                modelo: modeloProduto,
                armazenamento: armazenamento,
                ram: memoriaRam,
                tamanhoTela: tamanhoTela,

                funcionamento,
                estado: nomesEstados[funcionamento],
                problema: problema.trim(),
                descricaoCompleta: descricao?.trim() || "",
                preco: Number(preco),
                imagens: [resultadoImagem.secure_url],
                criadoEm: new Date().toISOString()
            };

            // Salva o produto no Firebase Realtime Database
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

            return res.redirect("/ecoProdutos");

        }  catch (erro) {
    console.error("ERRO AO CADASTRAR ELETRÔNICO:");
    console.error(erro);
    console.error("Mensagem:", erro.message);
    console.error("HTTP Code:", erro.http_code);

    if (erro instanceof multer.MulterError) {
        return res.status(400).send(
            "A imagem deve ter no máximo 5 MB."
        );
    }

    return res.status(500).send(
        "Erro ao cadastrar. Verifique o terminal."
    );
        }
    }
);

module.exports = router;
