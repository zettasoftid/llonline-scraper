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
        const links = await page.$$('a');

        console.log(links.length);

        // Loop through each link and click it to show the license data
        for (let i = 0; i < links.length; i++) {
            await page.waitForNavigation();
            await links[i].click();

            const popupPage = (await browser.pages())[2];
            // Grab data element in popup
            const namePopupPage = await popupPage.$eval('#lbl_name', e => e.textContent);
            const addressPopupPage = await popupPage.$eval('#lbl_add', e => e.textContent);
            // Get the license number from the popup
            const licenseNumber = await popupPage.$eval('#lbl_info', el => el.querySelector('b:nth-child(2)').textContent);

            // Log the license data to the console
            console.log(`Name: ${namePopupPage}`);
            console.log(`Address: ${addressPopupPage}`);
            console.log(`License Number: ${licenseNumber}`);

            // Close the popup page
            await popupPage.close();
        }

        // Close the browser
        await browser.close();

    } catch (error) {
        console.error(error);
        await browser.close();
    }
})();

