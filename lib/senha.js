// ==========================================
// Proteção de senhas (scrypt, nativo do Node.js)
// ==========================================
//
// Formato salvo: scrypt$<salt em hex>$<hash em hex>
// Senhas antigas, salvas em texto puro, continuam sendo aceitas no login
// e são convertidas automaticamente para o novo formato.

const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);

const PREFIXO = "scrypt";
const TAMANHO_HASH = 64;

function estaProtegida(armazenada) {
    return (
        typeof armazenada === "string" &&
        armazenada.startsWith(`${PREFIXO}$`)
    );
}

async function hashSenha(senha) {
    const sal = crypto.randomBytes(16);
    const hash = await scrypt(senha, sal, TAMANHO_HASH);

    return `${PREFIXO}$${sal.toString("hex")}$${hash.toString("hex")}`;
}

async function verificarSenha(senha, armazenada) {
    if (typeof senha !== "string" || typeof armazenada !== "string") {
        return false;
    }

    try {
        // Senha antiga em texto puro (compara via hash para tempo constante)
        if (!estaProtegida(armazenada)) {
            const a = crypto.createHash("sha256").update(senha).digest();
            const b = crypto.createHash("sha256").update(armazenada).digest();

            return crypto.timingSafeEqual(a, b);
        }

        const [, salHex, hashHex] = armazenada.split("$");

        if (!salHex || !hashHex) {
            return false;
        }

        const esperado = Buffer.from(hashHex, "hex");
        const calculado = await scrypt(
            senha,
            Buffer.from(salHex, "hex"),
            esperado.length
        );

        return crypto.timingSafeEqual(calculado, esperado);
    } catch (erro) {
        return false;
    }
}

module.exports = { hashSenha, verificarSenha, estaProtegida };
