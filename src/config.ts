import * as z from "zod"
import "dotenv/config"
import { logger } from "./logger"

const envSchema = z.object({
    headless: z.stringbool().default(true),
    parallel_tabs: z.coerce.number().default(5),
    nhs_url: z.string().default("https://www.nhs.uk/medicines"),
})

export type Config = z.infer<typeof envSchema>

export function loadConfig(): Config {
    try {
        const input = {
            headless: process.env.HEADLESS,
            parallel_tabs: process.env.PARALLEL_TABS,
            nhs_url: process.env.NHS_URL,
        }
        const cfg = envSchema.parse(input)
        return cfg
    } catch (error) {
        logger.error({ error }, "Failed to load configuration")
        throw error
    }
}

// Global config for easier access on all files.
export const config = loadConfig()
