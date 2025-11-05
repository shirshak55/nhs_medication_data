import pino from "pino"
import pretty from "pino-pretty"
import "dotenv/config"

const level = (process.env.LOG_LEVEL || "info").toLowerCase()
const isCI = process.env.GITHUB_ACTIONS === "true" || process.env.CI === "true"
const usePretty = !!process.stdout.isTTY || isCI

const baseConfig = {
    level,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
}

const prettyStream = usePretty
    ? pretty({
          colorize: true,
          translateTime: "SYS:standard",
          singleLine: false,
      })
    : undefined

export const logger = pino(baseConfig, prettyStream)
