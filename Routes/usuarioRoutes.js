const express = require("express");
const router = express.Router();
const FIREBASE_URL = "https://ecotech-4344c-default-rtdb.firebaseio.com/"
 

//tela do login
router.get("/login", (req, res) => {
    res.render("usuario/login");
});

//aqui ele vai receber o login
router.post("/login", async (req, res) =>{
    const {email, senha} = req.body;
    
  try{
    const resposta = await fetch(
        `${FIREBASE_URL}/usuarios.json`
    );

    const usuarios = await resposta.json();

    let usuarioEncontrado = null;

    if(usuarios) {
        for (const id in usuarios){
            if(
                usuarios[id].email === email &&
                usuarios[id].senha === senha
            ){
                usuarioEncontrado = usuarios[id];
                break;
            }
        }
    }
    if(!usuarioEncontrado){
        return res.redirect("/login");
    }
    //salva o nome do usuário na sessão
    req.session.nome = usuarioEncontrado.nome;
    res.redirect("/usuario/dashboard");
  }  catch (erro){
    console.log(erro);
    res.redirect("/login");
  }
});

//cadastro
    router.get("/cadastro", (req, res)=>{
        res.render("usuario/cadastro");
    });

    router.post("/cadastro", async(req, res)=>{
        const{ nome, email, senha } = req.body;

        const novoUsuario = {
            nome: nome,
            email:email,
            senha: senha
        };

        try{
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
            res.redirect("/login");

        } catch (erro) {
            console.log(erro);
            res.redirect("/cadastro");
        }
    });

    //dashboard do usuário

    router.get("/usuario/dashboard", (req, res)=>{
        res.render("usuario/dashboard");
    });

module.exports = router;