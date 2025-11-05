import pino from "pino"
import pretty from "pino-pretty"
import "dotenv/config"

const level = (process.env.LOG_LEVEL || "info").toLowerCase()
const usePretty = !!process.stdout.isTTY

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
