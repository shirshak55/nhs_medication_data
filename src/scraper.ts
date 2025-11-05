import { type BrowserContext, type Page } from "playwright"
import { setTimeout } from "timers/promises"
import { logger } from "./logger"
import { config } from "./config"
import pLimit from "p-limit"
import type { MedicineInfo, MedicinePage, LinkItem } from "./types"

/**
 * Fetch all the medicine links from the NHS medicines A-Z page
 */
export async function scrapeMedicineUrl(
    context: BrowserContext,
): Promise<string[]> {
    const page = await context.newPage()
    await page.goto(config.nhs_url)

    logger.info("Navigating to medicines list...")
    await page.getByRole("link", { name: "Z", exact: true }).click()

    logger.info("Fetching medicine links...")
    const medicineLinks: string[] = []

    // Sometime page may not load fast, so we need to try 5 times.
    let attempt = 0

    while (true) {
        // Future: relying on .nhsuk-list--links  is probably not a good idea.
        const links = page.locator('.nhsuk-list--links a[href^="/medicines/"]')
        const count = await links.count()

        for (let i = 0; i < count; i++) {
            const fullUrl = await links
                .nth(i)
                .evaluate((el: HTMLAnchorElement) => el.href)
            if (fullUrl) {
                medicineLinks.push(fullUrl)
            } else {
                logger.warn("Invalid Link found, skipping")
            }
        }

        if (medicineLinks.length > 0 || attempt > 5) {
            break
        } else {
            logger.warn(
                `Unable to find medicine, delaying 1 second (attempt ${attempt}/5)`,
            )
            await setTimeout(1000)
        }
        attempt++
    }

    logger.info(`Found ${medicineLinks.length} medicine links`)

    if (medicineLinks.length === 0) {
        logger.error("No medicines found, exiting...")
        throw new Error("No Medicines found")
    }

    return medicineLinks
}

// This method scrapes the medicinal data in concurrent fashion.
export async function scrapeMedicineData(
    context: BrowserContext,
    medicineLinks: Array<string>,
) {
    const limit = pLimit(config.parallel_tabs)
    const promises: Promise<any>[] = []

    // medicineLinks.slice(0, 10)  // Uncommenting will help us to easily test during development
    for (const linkIndex in medicineLinks) {
        const link = medicineLinks[linkIndex]

        if (!link) {
            logger.warn({ link }, "Invalid link supplied")
            continue
        }

        const prom = limit(
            (...args) =>
                fetchMedicineData(...args).catch((e) =>
                    logger.error("Error during fetching data", e),
                ),
            context,
            linkIndex,
            link,
        )
        promises.push(prom)
    }
    let data = await Promise.all(promises)
    const validData = data.filter((item) => item !== null)

    logger.info(
        `Successfully scraped ${validData.length} out of ${medicineLinks.length} medicines`,
    )
    return validData
}

/**
 * Fetch detailed information about a specific medicine
 */
export async function fetchMedicineData(
    context: BrowserContext,
    linkIndex: string,
    link: string,
): Promise<MedicineInfo | null> {
    const page = await context.newPage()

    try {
        logger.info(`[${linkIndex}] Scraping medicine: ${link}`)
        await page.goto(link, { waitUntil: "networkidle" })

        // First we collect the basic data from the page.
        const heading = page.locator("h1")
        await heading.waitFor() // or await expect(heading).toBeVisible();

        const fullText = (await heading.innerText()).trim()

        let captionText = ""
        const captionLocator = page.locator(".nhsuk-caption-xl")

        if (await captionLocator.count()) {
            captionText = (await captionLocator.first().innerText()).trim()
        }

        const medicineName = captionText
            ? fullText.replace(captionText, "").trim()
            : fullText

        let otherBrandName: Array<string> = []
        if (captionText) {
            const match = captionText.match(/Other brand names:\s*(.*)/i)
            if (match?.[1]) {
                otherBrandName = match[1]
                    .trim()
                    .split(",")
                    .map((v) => v.trim())
            }
        }

        // Optional description
        let description = ""
        const descriptionLocator = page.locator("p.nhsuk-lede-text").first()

        if (await descriptionLocator.count()) {
            description = (await descriptionLocator.textContent())?.trim() ?? ""
        }

        // LinkItem type imported from ./types

        const sectionLinks: LinkItem[] = await page.$$eval(
            ".nhsuk-hub-key-links li a",
            (anchors) => {
                const result: { url: string; text: string }[] = []

                anchors.forEach((a) => {
                    const el = a as HTMLAnchorElement
                    const text = el.textContent?.trim() ?? ""
                    const url = el.href

                    if (text && url) {
                        result.push({ text, url })
                    }
                })

                return result
            },
        )

        const relatedConditions: LinkItem[] = await page.$$eval(
            'div.beta-hub-related-links-title:has-text("Related conditions") + ul.beta-hub-related-links li a',
            (anchors) => {
                const result: { url: string; text: string }[] = []

                anchors.forEach((a) => {
                    const el = a as HTMLAnchorElement
                    const text = el.textContent?.trim() ?? ""
                    const url = el.href

                    if (text && url) {
                        result.push({ text, url })
                    }
                })

                return result
            },
        )

        const usefulResources: LinkItem[] = await page.$$eval(
            'div.beta-hub-related-links-title:has-text("Useful resources") + ul.beta-hub-related-links li a',
            (anchors) => {
                const result: { url: string; text: string }[] = []

                anchors.forEach((a) => {
                    const el = a as HTMLAnchorElement
                    const text = el.textContent?.trim() ?? ""
                    const url = el.href

                    if (text && url) {
                        result.push({ text, url })
                    }
                })

                return result
            },
        )
        logger.info(
            `[${linkIndex}] Starting to extract data from ${sectionLinks.length} sections`,
        )

        const medicineInfo: MedicineInfo = {
            name: medicineName.trim(),
            otherBrandNames: otherBrandName,
            url: link,
            description: description.trim(),
            pages: await scrapeSections(context, sectionLinks),
            relatedConditions,
            usefulResources,
        }

        logger.info(
            `[${linkIndex}] Successfully scraped medicine: ${medicineName}`,
        )
        return medicineInfo
    } catch (error) {
        logger.error(
            { error, link },
            `[${linkIndex}] Failed to scrape medicine`,
        )
        return null
    } finally {
        await page.close()
    }
}

// We want to extract data from sections in parallel.
async function scrapeSections(
    context: BrowserContext,
    sectionLinks: Array<{ text: string; url: string }>,
) {
    let proms = []

    for (let section of sectionLinks) {
        // let text = section.text.toLowerCase()
        proms.push(scrapeSection(context, section.url))
    }

    return await Promise.all(proms)
}

export async function scrapeSection(
    context: BrowserContext,
    url: string,
): Promise<MedicinePage> {
    const page = await context.newPage()
    await page.goto(url)

    try {
        const data = await page.evaluate(() => {
            const normalize = (text: string | null | undefined): string =>
                (text || "")
                    .replace(/\r\n/g, "\n") // normalise Windows newlines
                    .replace(/[ \t]+/g, " ") // collapse spaces & tabs, keep newlines
                    .replace(/\n{3,}/g, "\n\n") // shrink huge gaps
                    .trim()

            const normalizeEl = (el: Element | null | undefined): string =>
                normalize(el?.textContent)

            const activeNavItem = document.querySelector(
                ".beta-nhsuk-navigation-sideways__item.is-active",
            )

            const key = normalizeEl(activeNavItem)
            if (!key) {
                throw { message: "Invalid page heading" }
            }

            const article = document.querySelector(
                "article",
            ) as HTMLElement | null
            if (!article) {
                return { sectionName: key }
            }

            // If we see details tag, that probably indicates question and answer
            // Relying on specific class is probably not a good idea.
            const detailsEls = Array.from(
                article.querySelectorAll("details.nhsuk-details"),
            )

            if (detailsEls.length > 0) {
                const qa: { question: string; answer: string }[] = []

                detailsEls.forEach((d) => {
                    const question = normalizeEl(
                        d.querySelector(".nhsuk-details__summary-text"),
                    )

                    // collect paragraphs, headings and list items inside the answer
                    const answerParts = Array.from(
                        d.querySelectorAll(
                            ".nhsuk-details__text p, .nhsuk-details__text h3, .nhsuk-details__text li",
                        ),
                    )
                        .map((el) => normalizeEl(el))
                        .filter(Boolean)

                    const answer = answerParts.join("\n\n")

                    if (question && answer) {
                        qa.push({ question, answer })
                    }
                })

                // Q&A page structure
                return {
                    sectionName: key,
                    qa,
                }
            }

            const sections = Array.from(
                article.querySelectorAll("section"),
            ) as HTMLElement[]

            let description = ""

            if (sections.length > 0) {
                description = normalize(
                    sections.map((sec) => sec.innerText).join("\n\n"),
                )
            } else {
                // Fallback: take whole article text if there are no <section> tags
                description = normalize(
                    (article as HTMLElement).innerText || "",
                )
            }

            let keyFacts: string[] = []
            const keyFactsSection = sections.find((sec) => {
                const h2 = sec.querySelector("h2")
                return normalizeEl(h2) === "Key facts"
            }) as HTMLElement | undefined

            if (keyFactsSection) {
                keyFacts = Array.from(keyFactsSection.querySelectorAll("li"))
                    .map((li) => normalizeEl(li))
                    .filter(Boolean)
            }

            return {
                sectionName: key,
                description,
                ...(keyFacts.length > 0 ? { keyFacts } : {}),
            }
        })
        return data
    } finally {
        await page.close()
    }
}
