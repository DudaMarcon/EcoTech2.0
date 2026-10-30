
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const app = express();

// Permite acessar arquivos da pasta Public
app.use(express.static("Public"));

// Permite receber dados dos formulários
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");

// Sessão
app.use(
  session({
    secret: "ecotech123",
    resave: false,
    saveUninitialized: false,
  })
);

// Passa o nome da sessão para todas as páginas
app.use((req, res, next) => {
  res.locals.nomeUsuario = req.session.nome;
  next();
});

// ==========================================
// TECHAPI
// ==========================================

const URL_TECHAPI =
  "https://gettechapi.github.io/TechAPI/v1";

const categoriasTechAPI = {
  celular: "smartphones",
  tablet: "tablets",
  computador: "laptops",
  televisao: "monitors"
};

// Cache para não baixar os mesmos arquivos repetidamente
const cacheTechAPI = new Map();

async function consultarTechAPI(caminho) {
  if (cacheTechAPI.has(caminho)) {
    return cacheTechAPI.get(caminho);
  }

  const consulta = (async () => {
    const resposta = await fetch(
      `${URL_TECHAPI}/${caminho}`,
      {
        headers: {
          accept: "application/json"
        },
        signal: AbortSignal.timeout(20000)
      }
    );

    if (!resposta.ok) {
      throw new Error(
        `TechAPI respondeu com status ${resposta.status}`
      );
    }

    return resposta.json();
  })();

  cacheTechAPI.set(caminho, consulta);

  try {
    return await consulta;
  } catch (erro) {
    cacheTechAPI.delete(caminho);
    throw erro;
  }
}

// Obtém o catálogo de uma categoria
async function obterCatalogo(categoria) {
  const recurso = categoriasTechAPI[categoria];

  if (!recurso) {
    throw new Error("Categoria não disponível na TechAPI.");
  }

  const dados = await consultarTechAPI(
    `${recurso}/index.json`
  );

  if (!Array.isArray(dados.results)) {
    throw new Error("Formato inválido do catálogo.");
  }

  return dados.results;
}

// Obtém a lista de marcas
async function obterMarcas() {
  const dados = await consultarTechAPI(
    "brands/index.json"
  );

  if (!Array.isArray(dados.results)) {
    throw new Error("Formato inválido da lista de marcas.");
  }

  return dados.results;
}

// Busca marcas disponíveis na categoria selecionada
app.get("/api/ecotech/marcas", async (req, res) => {
  try {
    const categoria = String(req.query.categoria || "");

    if (!categoriasTechAPI[categoria]) {
      return res.status(400).json({
        erro: "Categoria não disponível na TechAPI."
      });
    }

    const [catalogo, marcas] = await Promise.all([
      obterCatalogo(categoria),
      obterMarcas()
    ]);

    // Identifica as marcas presentes no catálogo
    const marcasDisponiveis = marcas
      .filter(marca =>
        catalogo.some(item =>
          typeof item.slug === "string" &&
          item.slug.startsWith(marca.slug + "-")
        )
      )
      .map(marca => marca.name)
      .filter(Boolean);

    res.json(
      [...new Set(marcasDisponiveis)].sort(
        (a, b) => a.localeCompare(b, "pt-BR")
      )
    );

  } catch (erro) {
    console.error(
      "Erro ao buscar marcas na TechAPI:",
      erro.message
    );

    res.status(502).json({
      erro: "Não foi possível carregar as marcas."
    });
  }
});

// Pesquisa modelos pela categoria e marca selecionadas
app.get("/api/ecotech/modelos", async (req, res) => {
  try {
    const categoria = String(req.query.categoria || "");
    const marca = String(req.query.marca || "").trim();
    const termo = String(req.query.termo || "").trim();

    if (!categoriasTechAPI[categoria] || !marca) {
      return res.status(400).json({
        erro: "Informe uma categoria e uma marca."
      });
    }

    if (termo.length < 2 || termo.length > 100) {
      return res.status(400).json({
        erro: "Digite entre 2 e 100 caracteres."
      });
    }

    const [catalogo, marcas] = await Promise.all([
      obterCatalogo(categoria),
      obterMarcas()
    ]);

    const marcaSelecionada = marcas.find(
      item =>
        item.name.toLocaleLowerCase("pt-BR") ===
        marca.toLocaleLowerCase("pt-BR")
    );

    if (!marcaSelecionada) {
      return res.status(404).json({
        erro: "Marca não encontrada."
      });
    }

    const termoNormalizado =
      termo.toLocaleLowerCase("pt-BR");

    const prefixoMarca = marcaSelecionada.slug + "-";

    const modelos = catalogo
      .filter(item => {
        const pertenceAMarca =
          typeof item.slug === "string" &&
          item.slug.startsWith(prefixoMarca);

        const correspondeAoTermo =
          typeof item.name === "string" &&
          item.name.toLocaleLowerCase("pt-BR")
            .includes(termoNormalizado);

        return pertenceAMarca && correspondeAoTermo;
      })
      .slice(0, 40)
      .map(item => ({
        nome: item.name,
        id: item.slug
      }));

    res.json(modelos);

  } catch (erro) {
    console.error(
      "Erro ao pesquisar modelos na TechAPI:",
      erro.message
    );

    res.status(502).json({
      erro: "Não foi possível pesquisar os modelos."
    });
  }
});

// ==========================================
// ROTAS DO SITE
// ==========================================

const sobreRoutes = require("./Routes/sobreRoutes");
app.use(sobreRoutes);

const usuarioRoutes = require("./Routes/usuarioRoutes");
app.use(usuarioRoutes);

const reciclaRoutes = require("./Routes/reciclaRoutes");
app.use(reciclaRoutes);

const ecoProdutosRoutes = require("./Routes/ecoProdutosRoutes");
app.use(ecoProdutosRoutes);

const cadastrarEletronicosRoutes =
  require("./Routes/cadastrarEletronicosRoutes");

app.use(cadastrarEletronicosRoutes);

const verificarLoginRoutes =
  require("./Routes/verificarLoginRoutes");

app.use("/verificarLogin", verificarLoginRoutes);

// Página inicial
app.get("/", (req, res) => {
  res.render("index");
});

// Inicialização
app.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});
