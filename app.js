const express = require("express"); // aqui importa o express

const app = express();

// Permite acessar arquivos da pasta public
app.use(express.static("Public"));

app.set("view engine", "ejs");

const sobreRoutes = require("./Routes/sobreRoutes");

app.use(sobreRoutes);

app.get("/", (req, res) => {
    res.render("index");
});

app.listen(3000, () => {
    console.log("Servidor rodando em http://localhost:3000");
});