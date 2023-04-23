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
        let data = [];
        const page = await browser.newPage();
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36'
        );

        // Go to the license lookup page
        await Promise.race([
            page.goto('https://verify.llronline.com/LicLookup/Optometry/Optometry.aspx?div=42'),
            new Promise(resolve => setTimeout(resolve, 60000)) // 1 minute timeout
        ]);


        // Enter a search term for the last name
        await page.type('#ctl00_ContentPlaceHolder1_UserInputGen_txt_lastName', 'Smith');

        // Click the search button
        await page.click('#aspnetForm > div:nth-child(5) > table > tbody > tr > td:nth-child(1) > table > tbody > tr:nth-child(5) > td.tdrightside > button');

        // Wait for the results to load
        const selector = '#ctl00_ContentPlaceHolder2_gv_results > tbody';

        await page.waitForSelector(selector);

        // Get the license numbers from the results table
        const licenseNumbers = await Promise.race([
            page.$$eval(selector + ' > tr', rows => {
                return Array.from(rows, row => {
                    const cells = row.querySelectorAll("td");
                    if (cells.length < 7) {
                        // Return null if the row doesn't have enough td elements
                        return null;
                    }
                    return cells[0].innerText;
                }).filter(item => item !== null); // Remove null values from the array
            }),
            new Promise(resolve => setTimeout(resolve, 60000)) // 1 minute timeout
        ]);

        // Loop through each license number and open the details popup
        for (let i = 0; i < licenseNumbers.length; i++) {
            // Find the table cell that contains the license number and click it to open the details popup
            const licenseNumberCell = await page.$(`#ctl00_ContentPlaceHolder2_gv_results > tbody > tr:nth-child(${2 + i}) > td:nth-child(1) > a`);
            await licenseNumberCell.click();

            // Wait for a new target to be created (i.e., the popup)
            const popupTarget = await browser.waitForTarget(target => target.opener() === page.target());

            // Get the page object for the popup
            const popupPage = await popupTarget.page();
            // Grab data element in popup
            const namePopupPage = await popupPage.$eval('#lbl_name', e => e.textContent);
            const addressPopupPage = await popupPage.$eval('#lbl_add', e => e.textContent);
            // Get the license number from the popup
            const licenseNumber = await popupPage.$eval('#lbl_info', el => el.querySelector('b:nth-child(2)')?.nextSibling?.nodeValue?.trim() || "");
            const licenseType = await popupPage.$eval('#lbl_info', el => el.querySelector('b:nth-child(4)')?.nextSibling?.nodeValue?.trim() || "");
            const certification = await popupPage.$eval('#lbl_info', el => el.querySelector('b:nth-child(6)')?.nextSibling?.nodeValue?.trim() || "");
            const originalIssueDate = await popupPage.$eval('#lbl_info', el => el.querySelector('b:nth-child(8)')?.nextSibling?.nodeValue?.trim() || "");
            const status = await popupPage.$eval('#lbl_info', el => el.querySelector('b:nth-child(10)')?.nextSibling?.nodeValue?.trim() || "");
            const expiration = await popupPage.$eval('#lbl_info', el => el.querySelector('b:nth-child(12)')?.nextSibling?.nodeValue?.trim() || "");
            const boardPublicActionHistory = await popupPage.$eval('#lbl_info', el => el.querySelector('b:nth-child(14)')?.nextSibling?.nodeValue?.trim() || "");
            // Log the license data to the console
            data.push({
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

            // Close the popup page
            await popupPage.close();
        }
        
        // Write the data to a file
        fs.writeFile('data.json', JSON.stringify(data), (err) => {
            if (err) throw err;
            console.log('Data has been written to data.json');
        });

        // Close the browser
        await browser.close();

    } catch (error) {
        console.error(error);
        await browser.close();
    }
})();