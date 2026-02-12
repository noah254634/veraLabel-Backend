import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? {
        
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: true,
            ignore: "pid,hostname", // optional: hide fields you don’t need
           colorize: true ,// colorize the output for development,
        }}
      : undefined
});

export default logger;
