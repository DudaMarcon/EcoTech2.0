require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");

const app = express();

const producao = process.env.NODE_ENV === "production";

// ==========================================
// CONFIGURAÇÕES
// ==========================================

// O segredo da sessão deve vir do .env (SESSION_SECRET)
let segredoSessao = process.env.SESSION_SECRET;

if (!segredoSessao) {
  if (producao) {
    console.error("Defina SESSION_SECRET no ambiente antes de iniciar.");
    process.exit(1);
  }

  segredoSessao = crypto.randomBytes(32).toString("hex");

  console.warn(
    "SESSION_SECRET não definido: usando um segredo temporário " +
    "(as sessões serão perdidas ao reiniciar o servidor)."
  );
}

// Necessário quando o site roda atrás de proxy (Render, Heroku etc.)
if (producao) {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Permite acessar arquivos da pasta Public
app.use(express.static(path.join(__dirname, "Public")));

// Permite receber dados dos formulários
app.use(express.urlencoded({ extended: true }));

// Sessão
app.use(
  session({
    name: "ecotech.sid",
    secret: segredoSessao,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: producao,
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 dias
    }
  })
);

// Passa o nome da sessão para todas as páginas
app.use((req, res, next) => {
    res.locals.nomeUsuario = req.session.nome;
    res.locals.tipoUsuario = req.session.tipo;
    next();
});

// ==========================================
// ROTAS DO SITE
// ==========================================

app.use(require("./Routes/sobreRoutes"));
app.use(require("./Routes/usuarioRoutes"));
app.use(require("./Routes/reciclaRoutes"));
app.use(require("./Routes/ecoProdutosRoutes"));
app.use("/admin", require("./Routes/adminRoutes"));
app.use(require("./Routes/notificacaoRoutes"));
app.use(require("./Routes/cadastrarEletronicosRoutes"));
app.use("/verificarLogin", require("./Routes/verificarLoginRoutes"));

// Página inicial
app.get("/", (req, res) => {
  res.render("index");
});

// ==========================================
// ERROS
// ==========================================

app.use((req, res) => {
  res.status(404).send("Página não encontrada.");
});

app.use((erro, req, res, next) => {
  console.error(erro);

  if (res.headersSent) {
    return next(erro);
  }

  res.status(erro.status || 500).send("Ocorreu um erro inesperado.");
});

// ==========================================
// INICIALIZAÇÃO
// ==========================================

const PORTA = process.env.PORT || 3000;

app.listen(PORTA, () => {
  console.log(`Servidor rodando em http://localhost:${PORTA}`);
});
