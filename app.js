const express = require("express"); // aqui importa o express
const session = require("express-session");
const app = express();

// Permite acessar arquivos da pasta public
app.use(express.static("Public"));
//vai permitir receber dados do formulário
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");

//sessão
app.use(
  session({
    secret: "ecotech123",
    resave: false,
    saveUninitialized: false,
  }),
);

//passa o nome da sessão para as todas as páginas. sessão = nome
app.use((req, res, next) => {
  res.locals.nomeUsuario = req.session.nome;
  next();
});

//rotas
const sobreRoutes = require("./Routes/sobreRoutes");
app.use(sobreRoutes);

const usuarioRoutes = require("./Routes/usuarioRoutes");
app.use(usuarioRoutes);

const reciclaRoutes = require("./Routes/reciclaRoutes");
app.use(reciclaRoutes);

const ecoProdutosRoutes = require("./Routes/ecoProdutosRoutes");
app.use(ecoProdutosRoutes);

const cadastrarEletronicosRoutes = require("./Routes/cadastrarEletronicosRoutes");
app.use(cadastrarEletronicosRoutes);

const verificarLoginRoutes = require("./Routes/verificarLoginRoutes");
app.use("/verificarLogin", verificarLoginRoutes);


app.get("/", (req, res) => {
  res.render("index");
});

app.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});
