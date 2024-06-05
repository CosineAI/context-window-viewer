import app from "./server"
import { toSSG } from "hono/ssg"
import fs from "fs/promises"

toSSG(app, fs).then((result) => {
  process.exit(result.success ? 0 : 1)
})
