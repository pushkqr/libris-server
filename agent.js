const Book = require("./models/book");
// const { imageSize } = require("image-size");
// const { Buffer } = require("buffer");

const {
  Agent,
  run,
  setTracingDisabled,
  setDefaultOpenAIClient,
  setOpenAIAPI,
  MCPServerStdio,
  tool,
} = require("@openai/agents");
const OpenAI = require("openai");
const { z } = require("zod");

let model;

require("dotenv").config();

if (
  !process.env.BASE_URL ||
  !process.env.API_KEY ||
  !process.env.MODEL_NAME ||
  !process.env.BRAVE_API_KEY ||
  !process.env.SERPER_API_KEY
) {
  throw new Error(
    "Please set BASE_URL, API_KEY, MODEL_NAME, BRAVE_API_KEY, SERPER_API_KEY via env var."
  );
}

const LinksSchema = z.object({
  links: z.array(z.string().url()).max(5),
});

const BookSchema = z.object({
  title: z.string(),
  author: z.string(),
  overview: z.string(),
  coverUrl: z.string(),
});
const BooksSchema = z.object({
  books: z.array(BookSchema).max(5),
});

class Model {
  #client;
  #linkAgent;
  #searchAgent;
  #mcpServers = [];
  #initialized = false;

  constructor() {
    this.#client = new OpenAI({
      apiKey: process.env.API_KEY,
      baseURL: process.env.BASE_URL,
    });
    setDefaultOpenAIClient(this.#client);
    setOpenAIAPI("chat_completions");
    setTracingDisabled(false);
  }

  async #init() {
    if (this.#initialized) return;
    const braveServer = new MCPServerStdio({
      command: "npx",
      args: ["-y", "@brave/brave-search-mcp-server"],
      env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY },
    });
    await braveServer.connect();
    this.#mcpServers.push(braveServer);

    const fetchBooksTool = tool({
      name: "fetch_book",
      description:
        "Fetch relevant books based on the query provided. Returns an array of objects, each with metadata about a book matching the query sorted by relevance.",
      parameters: z.object({ query: z.string() }),
      execute: async function ({ query }) {
        const encoded = encodeURIComponent(query);
        console.log(`https://openlibrary.org/search.json?q=${encoded}`);
        try {
          let timer;
          const res = await Promise.race([
            fetch(`https://openlibrary.org/search.json?q=${encoded}`),
            new Promise((_, reject) => {
              timer = setTimeout(() => {
                reject(new Error("Request timed out"));
              }, 5000);
            }),
          ]);

          clearTimeout(timer);
          if (!res.ok) {
            return {
              error: "fetch-failed",
              books: [],
            };
          }

          const data = await res.json();
          const parse = data.docs.slice(0, 5);
          const books = parse.map((b) => {
            const coverUrl = b.cover_i
              ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg`
              : Book.PLACEHOLDER;
            return {
              title: b.title,
              author: b.author_name.join(", "),
              cover_i: b.cover_i,
              coverUrl: coverUrl,
            };
          });

          return {
            books: books,
          };
        } catch (error) {
          return {
            error: error.message,
            books: [],
          };
        }
      },
    });
    const searchTool = tool({
      name: "serper_search",
      description:
        "Performs a web search using Serper and returns relevant results.",
      parameters: z.object({ query: z.string() }),
      execute: async function ({ query }) {
        try {
          let timer;
          const res = await Promise.race([
            fetch(
              `https://google.serper.dev/search?q=${encodeURIComponent(
                query
              )}&apiKey=${process.env.SERPER_API_KEY}`
            ),
            new Promise((_, reject) => {
              timer = setTimeout(() => {
                reject(new Error("Request timed out"));
              }, 5000);
            }),
          ]);

          clearTimeout(timer);

          if (!res.ok) {
            return {
              error: "fetch-failed",
            };
          }

          const data = await res.json();
          return {
            result: data,
          };
        } catch (error) {
          return { error: error.message };
        }
      },
    });

    this.#linkAgent = new Agent({
      name: "Link Agent",
      instructions: `Return STRICT JSON: {"links": ["https://...", ...]} (max 5) for direct PDF candidates of the requested book. If none, {"links": []}. No commentary.`,
      model: process.env.MODEL_NAME,
      mcpServers: [braveServer],
    });

    this.#searchAgent = new Agent({
      name: "Search Agent",
      instructions: `You are a book search assistant. Given a book query:
1. Call tool "fetch_book" with the query to get up to 5 candidate books.
2. For each candidate build fields:
   - "title": exact title
   - "author": author(s) or ""
   - "overview": use tool "serper_search" with 'Book <title> overview' and distill to 2-3 neutral sentences (no opinions, no spoilers). If insufficient data use "".
   - "coverUrl": use https://covers.openlibrary.org/b/id/{cover_i}-L.jpg or placeholder if cover_i missing
3. Return STRICT JSON: {"books":[{"title":"...","author":"...","overview":"...","coverUrl":"..."}, ...]}
4. No commentary, no code fences.`,
      model: process.env.MODEL_NAME,
      tools: [fetchBooksTool, searchTool],
    });

    this.#initialized = true;
  }

  #parseJSON(raw, schema) {
    if (raw.startsWith("```")) {
      raw = raw
        .replace(/^```(json)?/i, "")
        .replace(/```$/, "")
        .trim();
    }
    try {
      let parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && schema === BooksSchema)
        parsed = { books: parsed };
      return schema.parse(parsed);
    } catch (error) {
      console.error("Parse error:", error.message, "\nRaw:", raw);
      throw new Error("Invalid JSON response from agent");
    }
  }

  async #invoke(agent, query) {
    return run(agent, query);
    // return Promise.race([
    //   run(agent, query),
    //   new Promise((_, reject) => {
    //     setTimeout(() => {
    //       reject(new Error("Agent Timeout"));
    //     }, 60000);
    //   }),
    // ]);
  }

  async search(query) {
    await this.#init();
    const result = await this.#invoke(this.#searchAgent, query);
    let raw = String(result.finalOutput || "").trim();
    const out = this.#parseJSON(raw, BooksSchema);
    return out.books;
  }

  async fetchLinks(query) {
    await this.#init();
    const result = await this.#invoke(this.#linkAgent, query);
    let raw = String(result.finalOutput || "").trim();
    const out = this.#parseJSON(raw, LinksSchema);
    return out.links;
  }

  async cleanup() {
    for (const tool of this.#mcpServers) {
      try {
        await tool.close();
      } catch {}
    }
  }
}

const getAgent = async function () {
  if (!model) {
    model = new Model();
    return model;
  }

  return model;
};

module.exports = getAgent;
