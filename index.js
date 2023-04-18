const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Go to the license lookup page
  await page.goto('https://verify.llronline.com/LicLookup/Optometry/Optometry.aspx?div=42');

  // Enter a search term for the last name
  await page.type('#txtLName', 'Smith');

  // Click the search button
  await page.click('#btnSearch');

  // Wait for the results to load
  await page.waitForSelector('#tblResults tbody tr');

  // Scrape the data from the results table
  const results = await page.evaluate(() => {
    const rows = document.querySelectorAll('#tblResults tbody tr');
    const licenses = [];

    for (const row of rows) {
      const cells = row.querySelectorAll('td');

      licenses.push({
        licenseNumber: cells[0].textContent.trim(),
        fullName: cells[1].textContent.trim(),
        status: cells[2].textContent.trim(),
        issueDate: cells[3].textContent.trim(),
        expirationDate: cells[4].textContent.trim()
      });
    }

    return licenses;
  });

  console.log(results);

  await browser.close();
})();