const puppeteer = require('puppeteer');

const AMAZON_GET_LINK_BUTTON_SELECTOR = '#amzn-ss-get-link-button';
const AMAZON_TEXT_SHORTLINK_TEXTAREA_SELECTOR = '#amzn-ss-text-shortlink-textarea';

class PuppeterController {
    constructor() {
      this.browser = null;
    }

    async launchBrowser() {
        this.browser = await puppeteer.launch({
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        });
    }

    async newPage() {
        if (!this.browser) {
            await this.launchBrowser();
        }
        const page = await this.browser.newPage();
        await this.removePageAutomationFlag(page);

        return page;
    }

    async removePageAutomationFlag(page) {
        return page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });
    }

    async closePage(page) {
        if (page) {
            await page.close();
        }
    }

    async getAmazonAssociateLink(url) {
        const page = await this.newPage();
        try {
            await page.goto(url);
            await page.click(AMAZON_GET_LINK_BUTTON_SELECTOR);
            await page.waitForSelector(AMAZON_TEXT_SHORTLINK_TEXTAREA_SELECTOR, {visible: true});
            return await page.$eval(AMAZON_TEXT_SHORTLINK_TEXTAREA_SELECTOR, el => el.textContent);
        } catch (error) {
            console.error('Error generating Amazon Associate link:', error);
            throw new Error('Failed to generate Amazon Associate link');
        } finally {
            if (page) {
                await this.closePage(page);
            }
        }
    }
}

module.exports = { PuppeterController };