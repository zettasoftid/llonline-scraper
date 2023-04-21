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

    // Interact with the popup page
    await page.waitForSelector('#ctl00_ContentPlaceHolder2_gv_results > tbody > tr:nth-child(2) > td:nth-child(1) > a');
    await page.click('#ctl00_ContentPlaceHolder2_gv_results > tbody > tr:nth-child(2) > td:nth-child(1) > a');

    // Wait for a new target to be created (i.e., the popup)
    const popupTarget = await browser.waitForTarget(target => target.opener() === page.target());

    // Get the page object for the popup
    const popupPage = await popupTarget.page();
    
    // Grab data element in popup
    const namePopupPage = await popupPage.$eval('#lbl_name', e => e.textContent);
    const addressPopupPage = await popupPage.$eval('#lbl_add', e => e.textContent);
    const licenseInfoPopupPage = await popupPage.$eval('#lbl_info', e => e.textContent);
    console.log({namePopupPage, addressPopupPage, licenseInfoPopupPage});

    // Delay for 10 seconds before closing the popup
    setTimeout(async () => {
      await popupPage.close();
      await browser.close();
    }, 10000);

  } catch (error) {
    console.error(error);
    await browser.close();
  }
})();
