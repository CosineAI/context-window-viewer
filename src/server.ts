import fs from "fs"
import ndjson from "ndjson"
import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { ssgParams } from "hono/ssg"

const getData = async (id: string): Promise<any> => {
  let didFind = false
  const out = new Promise((resolve, reject) => {
    const stream = fs
      .createReadStream("./context_windows.jsonl")
      .pipe(ndjson.parse())
      .on("data", async (obj) => {
        if (obj.meta.id === id) {
          // eslint-disable-next-line no-console
          console.log({ id: obj.meta.id, length: obj.messages.length })
          didFind = true
          stream.destroy()
          resolve(obj)
        }
      })
      .on("end", () => {
        if (!didFind) {
          reject(null)
        }
      })
      .on("close", () => {
        if (!didFind) {
          reject(null)
        }
      })
  })

  return out as any
}
type ContextMeta = { id: string; run_id: string; tiktoken_context_window_length: number; claude_context_length: number; num_messages: number; final_state?: any }
const getMetadata = async (): Promise<ContextMeta[]> => {
  const data: ContextMeta[] = []
  return new Promise((resolve) => {
    fs.createReadStream("./context_windows.jsonl")
      .pipe(ndjson.parse())
      .on("data", async (obj) => {
        data.push({
          id: obj.meta.id,
          tiktoken_context_window_length: obj.meta.tiktoken_context_window_length,
          claude_context_length: obj.meta.claude_context_length,
          num_messages: obj.meta.num_messages,
          run_id: obj.meta.run_id,
        })
      })
      .on("end", () => {
        resolve(data)
      })
  })
}

const app = new Hono()

app.get("/", async (c) => {
  const meta = await getMetadata()
  return c.html(`
<!DOCTYPE html>
<html>
<head>
<title>Context Window Viewer</title>
</head>
<body>
<h1>Cosine Context Window Viewer</h1>
ID - Messages [ Tokens: TikToken - Claude ] <br>
${meta
  .map(
    (m) =>
      `<a href="/context/${m.id}/">${m.id}</a> ${
        m.num_messages
      } messages [ tokens: ${m.tiktoken_context_window_length.toLocaleString()} - ${m.claude_context_length.toLocaleString()} ] <br>`,
  )
  .join("")}
</body
</html>
`)
})

const displayMessages = (data: any): string => {
  data.messages.pop()
  return data.messages
    .map(
      (msg: any, index: number) => `
<div id="message-${index}" class="w-100">
<div class="sticky w-full top-0 bg-white/80 backdrop-blur-md py-4">
  <div class="flex justify-between w-full">
    <div>
    ${msg.role} 
    </div>
    <div>
    ${index + 1} of ${data.meta.num_messages - 1}
    </div>
    <div>
      <a class="bg-pink-200 rounded-md p-2 hover:bg-pink-500 hover:text-white" href="#message-${index - 1}">Previous (${index})</a>
      <a class="bg-pink-300 rounded-md p-2 hover:bg-pink-500 hover:text-white" href="#message-${index + 1}">Next (${index + 2})</a>
    </div>
  </div>
</div>
    <div  class="px-6 pb-6 rounded-md ${
      msg.role === "assistant" ? "bg-gray-200" : msg.role === "system" ? "bg-pink-400 text-white" : "bg-blue-500 text-white"
    } break-words whitespace-pre-wrap font-mono" >
      ${msg.content}
    </div>
  `,
    )
    .join("")
}
app.get(
  "/context/:id/",
  ssgParams(async () => {
    const windows = await getMetadata()
    return windows.map((w) => ({ id: w.id }))
  }),
  async (c) => {
    const id = c.req.param("id")

    try {
      const window = await getData(id)

      return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${id} | Context Viewer</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 flex flex-row">
<div id="top" class="sticky top-5 mt-2 m-auto w-full text-center">
<a href="/" class="underline text-gray-500"><- Back to Index</a> 
<h1 class="">Currently Viewing</h1>
<h2 class="text-2xl font-bold">${id}</h2>
<p>Run ID: ${window.meta.run_id}</p>
<p>Number of Messages: ${window.meta.num_messages}</p>
<p><span class="text-sm">Context Length:</span><br />${window.meta.tiktoken_context_window_length.toLocaleString()} tokens (TikToken)<br />
${window.meta.claude_context_length.toLocaleString()} tokens (Claude)</p>
<a href="./json/index.json" class="underline text-gray-500">View as json</a> | <a href="#end" class="underline text-pink-500">Jump to End</a>
</div>
    <div class="flex flex-col items-center justify-center">
        <div id="chat" class="w-full bg-white shadow-md rounded p-6 mt-6">
        <div id="top-of-chat"></div>
${displayMessages(window)}
        </div>
    </div>
<div>
<h1 id="end" class="text-2xl text-center pt-8"> END of Context </h1>
<a href="#top-of-chat" class="block text-center pb-6 text-pink-500 font-2xl underline">Back to Top</a>

<h1 class="text-2xl font-bold">Final State Content: </h1>
<div class="font-mono break-words whitespace-pre-wrap">
<input type="text" value="${window.meta.final_state.content}" />
<button>Save</button>
</div>


<a href="#top-of-chat" class="block text-center pb-6 text-pink-500 font-2xl underline">Back to Top</a>
</div>
</body>
</html>
`)
    } catch (e: any) {
      if (e instanceof Error) {
        return c.text(e.message, 500)
      }
      return c.text("Not found", 404)
    }
  },
)

app.get(
  "/context/:id/json/",
  ssgParams(async () => {
    const windows = await getMetadata()
    return windows.map((w) => ({ id: w.id }))
  }),
  async (c) => {
    const id = c.req.param("id")

    try {
      const window = await getData(id)

      return c.json(window)
    } catch (e: any) {
      if (e instanceof Error) {
        return c.text(e.message, 500)
      }
      return c.text("Not found", 404)
    }
  },
)

//eslint-disable-next-line
console.log("Starting server on http://localhost:8787")

serve({
  fetch: app.fetch,
  port: 8787,
})

export default app
