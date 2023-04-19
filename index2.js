const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--start-maximized',
            `--disable-blink-features=AutomationControlled`,
            `--disable-web-security`,
            `--allow-running-insecure-content`
        ],
        defaultViewport: null
    });

    const page = await browser.newPage();
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36'
    );
    
    await page.goto('https://verify.llronline.com/LicLookup/Optometry/Optometry.aspx?div=42');
    
    await page.type('#ctl00_ContentPlaceHolder1_UserInputGen_txt_lastName', 'Smith');
    await page.click('#aspnetForm > div:nth-child(5) > table > tbody > tr > td:nth-child(1) > table > tbody > tr:nth-child(5) > td.tdrightside > button');
    
    const selector = '#ctl00_ContentPlaceHolder2_gv_results > tbody';
    await page.waitForSelector(selector);
    
    const data = await page.$$eval(selector + ' > tr', async (rows, page) => {
        const newData = [];
    
        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (cells.length < 7) {
                newData.push(null);
                continue;
            }
            const licenseNumber = cells[0].innerText;
            const licenseLink = row.querySelector('a');
    
            if (licenseLink) {
                const [newPage] = await Promise.all([
                    new Promise(resolve => page.once('popup', resolve)),
                    licenseLink.click({delay: 3000})
                ]);
                await newPage.waitForSelector('#ctl00_MainContent_dg_main');
                const details = {};
                const tableRows = await newPage.$$('#ctl00_MainContent_dg_main > tbody > tr');
                for (const row of tableRows) {
                    const label = await row.$('.Lbl');
                    const value = await row.$('.Dta');
                    if (label && value) {
                        switch (label.textContent.trim()) {
                            case 'Certification':
                                details.certification = value.textContent.trim();
                                break;
                            case 'Initial Approval Date':
                                details.originalIssueDate = value.textContent.trim();
                                break;
                            case 'Current Expiration Date':
                                details.expiration = value.textContent.trim();
                                break;
                            case 'Current Status':
                                details.status = value.textContent.trim();
                                break;
                        }
                    }
                }
                newData.push({
                    licNum: licenseNumber,
                    details: details
                });
                await newPage.close();
            } else {
                newData.push({
                    licNum: licenseNumber,
                    details: null
                });
            }
        }
        return newData;
    }, page);
    
    console.log(data);
    
    fs.writeFile('data.json',JSON.stringify(data), (err) => {
        if (err) throw err;
        console.log('Data written to file');
    });
    
    await browser.close();
    
    
})();
