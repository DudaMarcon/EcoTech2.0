// ==========================================
// Acesso centralizado ao Firebase Realtime Database (REST)
// ==========================================
//
// - Todos os caminhos são montados a partir de uma lista de segmentos
//   (ex.: ["produtos", id]) e cada segmento é validado. Isso impede que um
//   valor vindo da URL ou de um formulário (como "../usuarios") altere o
//   caminho acessado no banco.
// - FIREBASE_URL e FIREBASE_AUTH podem ser definidos no .env.

const BASE_URL = (
    process.env.FIREBASE_URL ||
    "https://ecotech-4344c-default-rtdb.firebaseio.com"
).replace(/\/+$/, "");

// Opcional: segredo do banco, usado quando as regras do Firebase são fechadas.
const TOKEN = process.env.FIREBASE_AUTH || "";

const TEMPO_LIMITE_MS = 15000;
const SEGMENTO_VALIDO = /^[A-Za-z0-9_-]{1,128}$/;

// Retorna true se o valor pode ser usado como parte de um caminho do Firebase
function idValido(valor) {
    return typeof valor === "string" && SEGMENTO_VALIDO.test(valor);
}

function montarUrl(caminho, parametros = {}) {
    const segmentos = Array.isArray(caminho)
        ? caminho
        : String(caminho).split("/").filter(Boolean);

    if (segmentos.length === 0 || !segmentos.every(idValido)) {
        throw new Error("Caminho inválido para o Firebase.");
    }

    const url = new URL(`${BASE_URL}/${segmentos.join("/")}.json`);

    for (const [chave, valor] of Object.entries(parametros)) {
        url.searchParams.set(chave, valor);
    }

    if (TOKEN) {
        url.searchParams.set("auth", TOKEN);
    }

    return url;
}

async function requisitar(metodo, caminho, { dados, parametros } = {}) {
    const temCorpo = dados !== undefined;

    const resposta = await fetch(montarUrl(caminho, parametros), {
        method: metodo,
        headers: temCorpo ? { "Content-Type": "application/json" } : undefined,
        body: temCorpo ? JSON.stringify(dados) : undefined,
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS)
    });

    if (!resposta.ok) {
        const erro = new Error(
            `Firebase respondeu HTTP ${resposta.status} (${metodo})`
        );
        erro.status = resposta.status;
        throw erro;
    }

    return resposta.json();
}

module.exports = {
    idValido,

    // Lê um nó (retorna null se não existir)
    ler: (caminho, parametros) =>
        requisitar("GET", caminho, { parametros }),

    // Busca filhos cujo campo é igual ao valor.
    // Exige ".indexOn" para o campo nas regras do Firebase.
    consultarPorCampo: (caminho, campo, valor) =>
        requisitar("GET", caminho, {
            parametros: {
                orderBy: JSON.stringify(campo),
                equalTo: JSON.stringify(valor)
            }
        }),

    // Substitui o nó (PUT)
    gravar: (caminho, dados) =>
        requisitar("PUT", caminho, { dados }),

    // Atualiza apenas os campos informados (PATCH)
    atualizar: (caminho, dados) =>
        requisitar("PATCH", caminho, { dados }),

    // Cria um filho com chave automática (POST). Retorna { name }
    criar: (caminho, dados) =>
        requisitar("POST", caminho, { dados }),

    remover: (caminho) =>
        requisitar("DELETE", caminho)
};
