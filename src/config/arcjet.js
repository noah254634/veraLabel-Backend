// src/config/arcjet.js
import {ENV} from "./env.js";
import arcjet, { shield, detectBot, fixedWindow ,tokenBucket} from "@arcjet/node";
export const aj = arcjet({
  key: ENV().arcjet_api_key,
  rules: [
    shield({mode:"LIVE"}), // basic protection
    detectBot({ mode: "LIVE", 
        allow:[
            "Search Engine Bots",
        ]
    }),
    fixedWindow({
      window: "1m",
      max: 100, // 100 requests per minute
    }),
  ],
});
