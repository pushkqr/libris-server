const Book = require("./models/book");

const {
  Agent,
  run,
  setTracingDisabled,
  setDefaultOpenAIClient,
  setOpenAIAPI,
  MCPServerStdio,
} = require("@openai/agents");
const OpenAI = require("openai");
const { z } = require("zod");

let model;

require("dotenv").config();

if (
  !process.env.BASE_URL ||
  !process.env.API_KEY ||
  !process.env.MODEL_NAME ||
  !process.env.BRAVE_API_KEY
) {
  throw new Error(
    "Please set BASE_URL, API_KEY, MODEL_NAME, BRAVE_API_KEY via env var."
  );
}

const LinksSchema = z.object({
  links: z.array(z.string().url()).max(5),
});

const BookSchema = z.object({
  title: z.string(),
  author: z.string(),
  edition: z.string(),
  overview: z.string(),
  isbn: z.string(),
  coverUrl: z.string().default(Book.PLACEHOLDER),
});
const BooksSchema = z.object({
  books: z.array(BookSchema).max(10),
});

class Model {
  #client;
  #linkAgent;
  #searchAgent;
  #tools = [];
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
    this.#tools.push(braveServer);

    this.#linkAgent = new Agent({
      name: "Link Agent",
      instructions: `Return STRICT JSON: {"links": ["https://...", ...]} (max 5) for direct PDF candidates of the requested book. If none, {"links": []}. No commentary.`,
      model: process.env.MODEL_NAME,
      mcpServers: [braveServer],
    });

    this.#searchAgent = new Agent({
      name: "Search Agent",
      instructions: `You are a book search assistant. Given a book query:
1. Use Brave Search to find relevant published books (skip articles/videos/lists).
2. If the query specifies an edition (e.g., "5th edition", "2023 edition"), search for that specific edition.
3. If NO edition is specified, only return the most recent or most popular edition available.
4. For each result provide:
   - "title": full accurate title (include edition in title if relevant, e.g., "Operating Systems: 10th Edition")
   - "author": full author name ("" if unknown)
   - "edition": edition text like "10th edition", "2023" or "" if unknown
   - "overview": a concise factual overview (no opinions, no large quotes, no spoilers). If insufficient data, use ""
   - "isbn": International Standard Book Number (ISBN-10 or ISBN-13)
   - "coverUrl": direct URL to valid book cover image. Prefer OpenLibrary covers (https://covers.openlibrary.org/b/isbn/{ISBN}-L.jpg) or Google Books.
5. Return STRICT JSON: {"books": [{"title": "...", "author": "...", "edition": "", "overview": "", "isbn": "", "coverUrl": ""}, ...]}
6. Maximum 10 results ordered by relevance.
7. No commentary, no code fences, only the JSON object.`,
      model: process.env.MODEL_NAME,
      mcpServers: [braveServer],
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
      const parsed = JSON.parse(raw);
      return schema.parse(parsed);
    } catch (error) {
      console.error("Parse error:", error.message, "\nRaw:", raw);
      throw new Error("Invalid JSON response from agent");
    }
  }

  async #invoke(agent, query) {
    return Promise.race([
      run(agent, query),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Agent Timeout"));
        }, 30000);
      }),
    ]);
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
    for (const tool of this.#tools) {
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
