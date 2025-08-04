const express = require('express');
const router = express.Router();
require('dotenv').config();
const puppeteer = require('puppeteer');
const rateLimit = require('express-rate-limit');

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
    const password = req.body.password;

    if (!password) {
        return res.status(400).send('Password is required');
    }

    if (password !== process.env.PASSWORD) {
        return res.status(403).send('Forbidden: Invalid password');
    }

    const {url} = req.body;

    if (!url) {
        return res.status(400).send('URL is required');
    }

    if (!validateUrl(url)) {
        return res.status(400).send('Invalid Amazon URL');
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
        res.send(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred while processing your request');
    }
});

module.exports = router;
