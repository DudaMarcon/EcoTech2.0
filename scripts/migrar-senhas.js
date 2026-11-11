// Converte todas as senhas antigas (texto puro) para hash.
// Faça um backup do banco antes (Firebase > Realtime Database > Exportar JSON).
//
// Uso: npm run migrar-senhas

require("dotenv").config();

const fb = require("../lib/firebase");
const { hashSenha, estaProtegida } = require("../lib/senha");

(async () => {
    const usuarios = await fb.ler(["usuarios"]);

    if (!usuarios) {
        console.log("Nenhum usuário encontrado.");
        return;
    }

    let migrados = 0;
    let jaProtegidos = 0;
    let semSenha = 0;

    for (const [id, usuario] of Object.entries(usuarios)) {
        if (!usuario || typeof usuario.senha !== "string" || !usuario.senha) {
            semSenha++;
            continue;
        }

        if (estaProtegida(usuario.senha)) {
            jaProtegidos++;
            continue;
        }

        await fb.atualizar(["usuarios", id], {
            senha: await hashSenha(usuario.senha)
        });

        migrados++;
    }

    console.log(
        `Concluído: ${migrados} migrado(s), ${jaProtegidos} já protegido(s), ${semSenha} sem senha.`
    );
})().catch((erro) => {
    console.error("Falha na migração:", erro.message);
    process.exit(1);
});
