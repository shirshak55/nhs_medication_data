import pino from "pino"
import "dotenv/config"

// Initializing config requires logger, so we aren't using config here.
const level = (process.env.LOG_LEVEL || "info").toLowerCase()

// Centralized logger to keep things simple.
export const logger = pino({
    level,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: {
        target: "pino-pretty",
        options: {
            colorize: true,
            translateTime: "SYS:standard",
            singleLine: false,
        },
    },
})
