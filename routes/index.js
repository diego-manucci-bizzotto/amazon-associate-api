const express = require('express');
const router = express.Router();
require('dotenv').config();
const puppeteer = require('puppeteer');
const rateLimit = require('express-rate-limit');
const {GoogleGenAI, Type} = require('@google/genai');


const limiter = rateLimit({
    windowMs: 10 * 1000, // 10 seconds
    max: 1, // 1 request per window per IP
    message: 'Too many requests from this IP, please try again later.',
});

const AMAZON_GET_LINK_BUTTON_SELECTOR = '#amzn-ss-get-link-button';
const AMAZON_TEXT_SHORTLINK_TEXTAREA_SELECTOR = '#amzn-ss-text-shortlink-textarea';

function launchBrowser() {
    const userDataDir = process.env.PUPPETEER_USER_DATA_DIR;

    if (!userDataDir) {
        throw new Error('userDataDir is not set');
    }

    return puppeteer.launch({
        headless: true,
        userDataDir,
        args: [
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ]
    });
}

function removeAutomationFlag(page) {
    return page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
    });
}

function validateUrl(url) {
    const amazonRegex = /^(https?:\/\/)?(www\.)?amazon\.(com|co\.uk|co\.jp|de|fr|it|es|ca|in|com\.br)(\/.*)?$/;
    return amazonRegex.test(url);
}

function getAmazonAssociateLink(page, url) {
    return new Promise(async (resolve, reject) => {
        try {
            await page.goto(url);
            await page.click(AMAZON_GET_LINK_BUTTON_SELECTOR);
            await page.waitForSelector(AMAZON_TEXT_SHORTLINK_TEXTAREA_SELECTOR, {visible: true});
            const result = await page.$eval(AMAZON_TEXT_SHORTLINK_TEXTAREA_SELECTOR, el => el.textContent);
            resolve(result);
        } catch (error) {
            reject(error);
        }
    });
}

router.post('/', limiter, async function (req, res, next) {
    const {url, description} = req.body;

    if (!url) {
        return res.status(400).send('URL is required');
    }

    if (!validateUrl(url)) {
        return res.status(400).send('Invalid Amazon URL');
    }

    if (!description) {
        return res.status(400).send('Description is required');
    }

    try {
        const browser = await launchBrowser()
            .catch((error => {
                console.error('Error launching browser:', error);
                res.status(500).send('Failed to launch browser');
            }));
        const page = await browser.newPage();
        await removeAutomationFlag(page);
        const result = await getAmazonAssociateLink(page, url);
        await browser.close();

        const ai = new GoogleGenAI({
            apiKey: process.env.GOOGLE_GENAI_API_KEY,
        });

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Generate a catchy social media post for the following product description, all in pt-BR. The post should include a title, a brief description, the original price, the discount amount, the final price after discount, and a coupon code if available. Keep the title under 10 words and maybe be all caps, you decide, the description under 15 words. The product description will contain a title first, followed by a description, then it might contain the original value of the product followed by the final value with the coupon applied, then the coupon if it has one and finally the link to access the product, some of those fields might be missing so be careful \n\nthe link will br this: " + result + "\n\n for the generated post, make sure to rewrite the contents to be more original \n\nProduct Description: " + description,
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

        res.send(response.text);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred while processing your request');
    }
});

module.exports = router;
