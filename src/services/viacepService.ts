export interface ViaCepResult {
    cep: string;
    logradouro: string;
    complemento: string;
    bairro: string;
    localidade: string;
    uf: string;
    ibge: string;
    gia: string;
    ddd: string;
    siafi: string;
    erro?: boolean;
}

/**
 * Busca os dados de um CEP usando a API pública do ViaCEP
 */
export const fetchViaCep = async (cep: string): Promise<ViaCepResult | null> => {
    // Limpa o CEP mantendo apenas números
    const cleanCep = cep.replace(/\D/g, '');

    if (cleanCep.length !== 8) {
        return null;
    }

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`Erro ViaCEP: ${response.status}`);
            return null;
        }

        const data: ViaCepResult = await response.json();

        // ViaCEP retorna erro: true se o CEP não existir
        if (data.erro) {
            console.warn(`ViaCEP: CEP ${cleanCep} não encontrado.`);
            return null;
        }

        return data;
    } catch (error) {
        console.error('ViaCEP exception:', error);
        return null;
    }
};

/**
 * Helper para extrair um CEP e, opcionalmente, o número da porta de uma string de texto.
 * Exemplo: "01001-000, 150" ou "cep 12345678 numero 42"
 */
export const extractCepAndNumber = (text: string): { cep: string | null, number: string | null } => {
    // Regex para encontrar CEPs (com ou sem hífens e pontuação adjacente)
    const cepRegex = /\b\d{5}-?\d{3}\b/;
    const cepMatch = text.match(cepRegex);

    if (!cepMatch) {
        return { cep: null, number: null };
    }

    const cep = cepMatch[0];

    // Remove o CEP do texto original para buscar o número no restante
    const textWithoutCep = text.replace(cep, '').trim();

    // Regex 1: Tenta pegar o número após as palavras "n", "nº", "numero" etc.
    const explicitNumberMatch = textWithoutCep.match(/(?:n[º°.]?|número|numero)\s*(\d+[A-Za-z]?)(?:\b|\s|,|-)/i);

    // Regex 2: Se sobrar apenas números e espaços soltos (ex o usuário digitou "86360000 2715")
    const strayNumberMatch = textWithoutCep.match(/(?:^|,\s*|\s+)(\d+[A-Za-z]?)(?:\b|\s|,|-)/);

    let number = null;
    if (explicitNumberMatch) {
        number = explicitNumberMatch[1];
    } else if (strayNumberMatch) {
        number = strayNumberMatch[1];
    }

    return {
        cep,
        number
    };
};
