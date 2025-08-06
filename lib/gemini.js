const {GoogleGenAI, Type} = require("@google/genai");

class GeminiController {
    constructor() {
        this.ai = new GoogleGenAI({
            apiKey: process.env.GOOGLE_GENAI_API_KEY,
        });
    }

    async generatePost(link, description) {
        const ai = this.ai;

        if (!ai) {
            throw new Error('GoogleGenAI is not initialized');
        }

        if (!description || typeof description !== 'string' || description.trim() === '') {
            throw new Error('Invalid description');
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: this.getPrompt(link, description),
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        postTitle: {
                            type: Type.STRING,
                            description: "A catchy title for the product, no more than 10 words."
                        },
                        postDescription: {
                            type: Type.STRING,
                            description: "A brief description of the product, no more than 50 words."
                        },
                        originalValue: {
                            type: Type.STRING,
                            description: "The original price of the product without any discounts."
                        },
                        discountValue: {
                            type: Type.STRING,
                            description: "The amount of money saved due to the discount."
                        },
                        finalValue: {
                            type: Type.STRING,
                            description: "The final price of the product after applying the discount."
                        },
                        couponCode: {
                            type: Type.STRING,
                            description: "If no coupon code is available, return an empty string."
                        },
                        productLink: {type: Type.STRING, description: "The link to access the product."},
                    },
                    propertyOrdering: [
                        "postTitle",
                        "postDescription",
                        "originalValue",
                        "discountValue",
                        "finalValue",
                        "couponCode",
                        "productLink"
                    ]
                },
            }
        });
    }

    getPrompt(link, description) {
        return `
        Você é um especialista em copywriting para redes sociais no Brasil.
        
        Com base na descrição do produto abaixo, gere uma postagem curta e atrativa em português (pt-BR), voltada para redes sociais (Instagram, Twitter, etc).
        
        **Objetivos da postagem:**
        - Criar um título impactante (no máximo 10 palavras). Pode usar letras maiúsculas se fizer sentido.
        - Criar uma descrição curta (até 15 palavras), que chame atenção e incentive o clique.
        - Informar os seguintes dados, se disponíveis: preço original, valor do desconto, preço final com desconto e código de cupom.
        - Incluir o link para o produto (veja abaixo).
        - Reescreva todas as partes com linguagem mais original, persuasiva e natural para redes sociais.
        - Ignore campos ausentes (ex: se não houver cupom, retorne string vazia).
        
        **Formato da resposta:** JSON com os seguintes campos:
        - postTitle: string
        - postDescription: string
        - originalValue: string
        - discountValue: string
        - finalValue: string
        - couponCode: string
        - productLink: string
        
        **Link do produto:** ${link}
        
        **Descrição do produto original:**
        ${description}
        `.trim();
    }
}

module.exports = { GeminiController };