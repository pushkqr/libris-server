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
  isbn: z.string(),
  year: z.string(),
  genre: z.array(z.string()),
  pages: z.string(),
  publisher: z.string(),
});
const BooksSchema = z.object({
  books: z.array(BookSchema).max(10),
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
    setTracingDisabled(process.env.DEBUG !== "true");
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
        "Fetch relevant books from OpenLibrary with detailed metadata (overview, pages, etc.).",
      parameters: z.object({ query: z.string() }),
      execute: async function ({ query }) {
        const encoded = encodeURIComponent(query);
        const FETCH_LIMIT = 10;
        try {
          let timer;
          const res = await Promise.race([
            fetch(
              `https://openlibrary.org/search.json?q=${encoded}&fields=key,title,author_name,cover_i,isbn,number_of_pages_median,first_publish_year,subject,publisher&limit=${FETCH_LIMIT}`
            ),
            new Promise((_, reject) => {
              timer = setTimeout(
                () => reject(new Error("Request timed out")),
                5000
              );
            }),
          ]);

          clearTimeout(timer);
          if (!res.ok) {
            return { error: "fetch-failed", books: [] };
          }

          const data = await res.json();
          const docs = data.docs;

          const books = await Promise.all(
            docs.map(async (b) => {
              const coverUrl = b.cover_i
                ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg`
                : Book.PLACEHOLDER;

              let overview = "";

              if (b.key) {
                if (process.env.DEBUG === "true") {
                  console.log(
                    `[DEBUG] Fetching work details: https://openlibrary.org${b.key}.json`
                  );
                }
                try {
                  const workRes = await fetch(
                    `https://openlibrary.org${b.key}.json`
                  );
                  if (workRes.ok) {
                    const work = await workRes.json();

                    if (typeof work.description === "string") {
                      overview = work.description;
                    } else if (work.description?.value) {
                      overview = work.description.value;
                    }
                  }
                } catch (err) {
                  console.warn(
                    `Failed to fetch work details for ${b.key}:`,
                    err.message
                  );
                }
              }

              return {
                title: b.title || "",
                author: Array.isArray(b.author_name)
                  ? b.author_name.join(", ")
                  : "",
                coverUrl: coverUrl,
                isbn: Array.isArray(b.isbn) && b.isbn[0] ? b.isbn[0] : "",
                overview: overview || "",
                pages: b.number_of_pages_median
                  ? String(b.number_of_pages_median)
                  : "",
                year: b.first_publish_year ? String(b.first_publish_year) : "",
                subject: b.subject || [],
                publisher: b.publisher || [],
              };
            })
          );

          if (process.env.DEBUG === "true") {
            console.log(`[DEBUG] fetch_book returned ${books.length} books`);
          }
          return { books };
        } catch (error) {
          if (process.env.DEBUG === "true") {
            console.error(`[DEBUG] fetch_book error:`, error.message);
          }
          return { error: error.message, books: [] };
        }
      },
    });
    const searchTool = tool({
      name: "serper_search",
      description:
        "Performs a web search using Serper and returns relevant results.",
      parameters: z.object({ query: z.string() }),
      execute: async function ({ query }) {
        if (process.env.DEBUG === "true") {
          console.log(`[DEBUG] serper_search called with query: ${query}`);
        }
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
1. Call tool "fetch_book" with the query to get candidate books.
2. Select candidate(s) relevant to the query.
3. For selected candidate(s) build fields:
   - "title": exact title
   - "author": author(s) or ""
   - "overview": brief description/overview. Clean the data if available in standard English.
   - "coverUrl": cover image URL.
   - "year": published year
   - "genre": select the top 3 most relevant genre(s) from property 'subject'.
   - "pages": number of median pages.
   - "isbn": ISBN-13 or ISBN-10
   - "publisher": select the most relevant/most popular publishing agency related to the book from the property 'publisher'
4. Return STRICT JSON: {"books":[{"title":"...","author":"...","overview":"...","coverUrl":"...","year": "...","genre": ["...", ...],"isbn": "...","pages":"...", "publisher": "..."}, ...]}
5. No commentary, no code fences.
6. CRITICAL RULES:
   - Return ONLY valid JSON with NO extra text before or after
   - NO commentary, NO markdown, NO explanations
   - If you cannot determine a field, use "" or []`,

      model: process.env.MODEL_NAME,
      tools: [fetchBooksTool],
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

    const lastBrace = raw.lastIndexOf("}");
    if (lastBrace !== -1 && lastBrace < raw.length - 1) {
      raw = raw.substring(0, lastBrace + 1);
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
    if (process.env.DEBUG === "true") {
      console.log(`[DEBUG] search() called with query: ${query}`);
    }
    await this.#init();
    const result = await this.#invoke(this.#searchAgent, query);
    let raw = String(result.finalOutput || "").trim();
    if (process.env.DEBUG === "true") {
      console.log(
        `[DEBUG] Agent raw output (first 200 chars):`,
        raw.slice(0, 200)
      );
    }
    const out = this.#parseJSON(raw, BooksSchema);
    if (process.env.DEBUG === "true") {
      console.log(`[DEBUG] Parsed ${out.books.length} books successfully`);
    }
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
