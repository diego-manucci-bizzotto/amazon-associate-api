const express = require('express');
const router = express.Router();
require('dotenv').config();
const rateLimit = require('express-rate-limit');
const {PuppeterController} = require('../lib/puppeter');
const {GeminiController} = require('../lib/gemini');

const puppeterController = new PuppeterController();
const geminiController = new GeminiController();

let limit;
(async () => {
    const pLimit = (await import('p-limit')).default;
    limit = pLimit(3);
})();

const limiter = rateLimit({
    windowMs: 10 * 1000, // 10 seconds
    max: 10, // 10 request per window per IP
    message: 'Too many requests from this IP, please try again later.',
});

let browser;

function validateUrl(url) {
    const amazonRegex = /^(https?:\/\/)?(www\.)?amazon\.(com|co\.uk|co\.jp|de|fr|it|es|ca|in|com\.br)(\/.*)?$/;
    return amazonRegex.test(url);
}

router.post('/', async function (req, res, next) {
    limit(() => handleRequest(req, res)).catch(error => {
        console.error('Error in request handler:', error);
        res.status(500).send('An error occurred while processing your request');
    })
});

async function handleRequest(req, res) {
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
        const link = puppeterController.getAmazonAssociateLink(url);
        const response = geminiController.generatePost(await link, description);
        res.send(response.text);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred while processing your request');
    }
}

module.exports = router;
