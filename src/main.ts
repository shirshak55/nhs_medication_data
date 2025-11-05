import { chromium } from "playwright-core"
import fs from "fs/promises"
import { logger } from "./logger"
import { config } from "./config"
import { scrapeMedicineData, scrapeMedicineUrl } from "./scraper"
import type { MedicineInfo } from "./types"

/**
 * Entrypoint of application.
 */
async function main() {
    logger.info("Starting NHS medicine scraper...")

    const browser = await chromium.launch({
        headless: config.headless,
        channel: "chrome",
    })

    const context = await browser.newContext({
        viewport: null,
    })

    try {
        // Scrape medicine data in parallel with concurrency limit
        logger.info(
            `Starting parallel scraping with ${config.parallel_tabs} concurrent tabs...`,
        )

        // We scrape all the links from NHS A-Z medication page.
        let medicineLinks = await scrapeMedicineUrl(context)

        // Finally scrape data from each individual page.
        let medicineInfo: MedicineInfo[] = await scrapeMedicineData(
            context,
            medicineLinks,
        )

        // Save the result in output.
        // In future: Stream output as soon as it is ready, so we don't need to wait for all data.
        const outputFile = "output.json"
        await fs.writeFile(outputFile, JSON.stringify(medicineInfo, null, 4))

        logger.info(`Results saved to ${outputFile}`)
    } finally {
        await browser.close()
        logger.info("Scraping completed successfully!")
    }
}

main().catch((error) => {
    logger.error("Fatal error in main", error)
    process.exit(1)
})
