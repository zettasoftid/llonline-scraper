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

    try {
        const page = await browser.newPage();
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36'
        );

        // Go to the license lookup page
        await page.goto('https://verify.llronline.com/LicLookup/Optometry/Optometry.aspx?div=42');

        // Enter a search term for the last name
        await page.type('#ctl00_ContentPlaceHolder1_UserInputGen_txt_lastName', 'Smith');

        // Click the search button
        await page.click('#aspnetForm > div:nth-child(5) > table > tbody > tr > td:nth-child(1) > table > tbody > tr:nth-child(5) > td.tdrightside > button');

        // Wait for the results to load
        const selector = '#ctl00_ContentPlaceHolder2_gv_results > tbody';
        await page.waitForSelector(selector);

        // Scrape the data from the results table
        const data = await page.$$eval(selector + ' > tr', rows => {
            return Array.from(rows, row => {
                const cells = row.querySelectorAll("td");
                if (cells.length < 7) {
                    // Return null if the row doesn't have enough td elements
                    return null;
                }
                cells[0].click();
                return {
                    licNum: cells[0].innerText,
                    last: cells[1].innerText,
                    first: cells[2].innerText,
                    middle: cells[3].innerText,
                    city: cells[4].innerText,
                    state: cells[5].innerText,
                    type: cells[6].innerText,
                };
            }).filter(item => item !== null); // Remove null values from the array
        });

        console.log(data);
        // Write the data to a file
        fs.writeFile('data.json', JSON.stringify(data), (err) => {
            if (err) throw err;
            console.log('Data has been written to data.json');
        });

        // Get all the links with tag "a" in the page
        const links = await page.$$('tr > a');

        console.log(links);

        // Loop through each link and click it to show the license data
        for (let i = 0; i < links.length; i++) {
            await page.waitForNavigation();
            await links[i].click();

            const popupPage = (await browser.pages())[2];
            // Grab data element in popup
            const namePopupPage = await popupPage.$eval('#lbl_name', e => e.textContent);
            const addressPopupPage = await popupPage.$eval('#lbl_add', e => e.textContent);
            const licenseNumber = await popupPage.$eval('#lbl_info', el => el.querySelector('b:nth-child(2)')?.nextSibling?.nodeValue?.trim() || "");
            const licenseType = await popupPage.$eval('#lbl_info', el => el.querySelector('b:nth-child(4)')?.nextSibling?.nodeValue?.trim() || "");
            const certification = await popupPage.$eval('#lbl_info', el => el.querySelector('b:nth-child(6)')?.nextSibling?.nodeValue?.trim() || "");
            const originalIssueDate = await popupPage.$eval('#lbl_info', el => el.querySelector('b:nth-child(8)')?.nextSibling?.nodeValue?.trim() || "");
            const status = await popupPage.$eval('#lbl_info', el => el.querySelector('b:nth-child(10)')?.nextSibling?.nodeValue?.trim() || "");
            const expiration = await popupPage.$eval('#lbl_info', el => el.querySelector('b:nth-child(12)')?.nextSibling?.nodeValue?.trim() || "");
            const boardPublicActionHistory = await popupPage.$eval('#lbl_info', el => el.querySelector('b:nth-child(14)')?.nextSibling?.nodeValue?.trim() || "");

            console.log({
                namePopupPage,
                addressPopupPage,
                licenseNumber,
                licenseType,
                certification,
                originalIssueDate,
                status,
                expiration,
                boardPublicActionHistory
            });

            // Delay for 3 seconds before closing the popup
            setTimeout(async () => {
                await popupPage.close();
                await browser.close();
            }, 3000);
        }

    } catch (error) {
        console.error(error);
        await browser.close();
    }
})();