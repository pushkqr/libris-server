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

const LINK_AGENT_INSTRUCTIONS = `You are a PDF link finder. Given a book query (title + author):

1. Use brave_web_search ONCE with query: "book_title author filetype:pdf download"
2. Look for direct PDF links in search results (.pdf URLs)
3. Prioritize:
   - University/educational repositories (.edu, .ac.uk)
   - Archive.org links
   - Publisher preview/sample PDFs
   - Open access repositories
4. Verify links by calling tool 'validate_pdf_link' for each candidate
5. Return STRICT JSON: {"links": ["https://...", ...]} (max 5 VALIDATED links). 
6. If none found, return {"links": []}

CRITICAL RULES:
- Call brave_web_search ONLY ONCE with optimized query
- Return ONLY valid JSON with NO extra text
- NO commentary, NO markdown, NO explanations
- Only validate links that look like direct PDFs (end in .pdf or have pdf in URL)
- Prefer .edu, .org, archive.org domains`;

const SEARCH_AGENT_INSTRUCTIONS = `You are a book search assistant. Given a book query:
1. Call tool "fetch_book" with the query to get candidate books.
2. Only select the book(s) relevant to the query. 
3. For selected book(s) build fields:
   - "title": exact title
   - "author": author(s) or ""
   - "overview": brief description/overview. Clean the data if available in layman plain text standard English.
   - "coverUrl": cover image URL.
   - "year": published year
   - "genre": select the top 3 most relevant genre(s) from property 'subject' in layman standard english.
   - "pages": number of median pages.
   - "isbn": ISBN-13 or ISBN-10
   - "publisher": select the most relevant/most popular publishing agency related to the book from the property 'publisher'
4. Return STRICT JSON: {"books":[{"title":"...","author":"...","overview":"...","coverUrl":"...","year": "...","genre": ["...", ...],"isbn": "...","pages":"...", "publisher": "..."}, ...]}
5. No commentary, no code fences.
6. CRITICAL RULES:
   - Return ONLY valid JSON with NO extra text before or after
   - NO commentary, NO markdown, NO explanations
   - If you cannot determine a field, use "" or []`;

const logger = {
  debug: (...args) => {
    if (process.env.DEBUG === "true") {
      console.log("[DEBUG]", ...args);
    }
  },
  warn: (...args) => {
    if (process.env.DEBUG === "true") {
      console.warn("[DEBUG]", ...args);
    }
  },
  error: (...args) => {
    if (process.env.DEBUG === "true") {
      console.error("[DEBUG]", ...args);
    }
  },
};

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

  async #fetchWorkOverview(key) {
    logger.debug(`Fetching work details: https://openlibrary.org${key}.json`);
    try {
      const workRes = await fetch(`https://openlibrary.org${key}.json`);
      if (workRes.ok) {
        const work = await workRes.json();
        if (typeof work.description === "string") {
          return work.description;
        } else if (work.description?.value) {
          return work.description.value;
        }
      }
    } catch (err) {
      logger.warn(`Failed to fetch work details for ${key}:`, err.message);
    }
    return "";
  }

  async #enrichBook(doc) {
    const coverUrl = doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
      : Book.PLACEHOLDER;

    let overview = "";
    if (doc.key) {
      overview = await this.#fetchWorkOverview(doc.key);
    }

    const sanitizeText = (text) => {
      if (!text) return "";
      return text
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, " ")
        .replace(/\r/g, "")
        .replace(/\t/g, " ")
        .trim();
    };

    const bookData = {
      title: doc.title || "",
      author: Array.isArray(doc.author_name) ? doc.author_name.join(", ") : "",
      coverUrl: coverUrl,
      isbn: Array.isArray(doc.isbn) && doc.isbn[0] ? doc.isbn[0] : "",
      overview: sanitizeText(overview),
      pages: doc.number_of_pages_median
        ? String(doc.number_of_pages_median)
        : "",
      year: doc.first_publish_year ? String(doc.first_publish_year) : "",
      subject: doc.subject || [],
      publisher: doc.publisher || [],
    };

    return bookData;
  }

  #createValidatePdfTool() {
    return tool({
      name: "validate_pdf_link",
      description:
        "Validate if a URL is an accessible PDF file by checking HTTP headers",
      parameters: z.object({
        url: z.string().url(),
      }),
      execute: async ({ url }) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          const res = await fetch(url, {
            method: "HEAD",
            signal: controller.signal,
            redirect: "follow",
          });

          clearTimeout(timeout);

          const contentType = res.headers.get("content-type") || "";
          const isAccessible = res.ok;
          const isPdf = contentType.includes("application/pdf");

          return {
            valid: isAccessible && isPdf,
            status: res.status,
            contentType: contentType,
            url: url,
          };
        } catch (error) {
          return {
            valid: false,
            error: error.message,
            url: url,
          };
        }
      },
    });
  }

  #createFetchBooksTool() {
    const self = this;
    return tool({
      name: "fetch_book",
      description:
        "Fetch relevant books from OpenLibrary with detailed metadata (overview, pages, etc.).",
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => {
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
          const books = await Promise.all(docs.map((b) => self.#enrichBook(b)));

          logger.debug(`fetch_book returned ${books.length} books`);
          return { books };
        } catch (error) {
          logger.error(`fetch_book error:`, error.message);
          return { error: error.message, books: [] };
        }
      },
    });
  }

  #createSearchTool() {
    // Reserved for future use (e.g., genre enrichment, publisher validation)
    return tool({
      name: "serper_search",
      description:
        "Performs a web search using Serper and returns relevant results. Reserved for future use.",
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        logger.debug(`serper_search called with query: ${query}`);
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
              }, 10000);
            }),
          ]);

          clearTimeout(timer);

          if (!res.ok) {
            return { error: "fetch-failed" };
          }

          const data = await res.json();
          return { result: data };
        } catch (error) {
          return { error: error.message };
        }
      },
    });
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

    const fetchBooksTool = this.#createFetchBooksTool();
    const validateLinksTool = this.#createValidatePdfTool();
    // searchTool reserved for future use
    const searchTool = this.#createSearchTool();

    this.#linkAgent = new Agent({
      name: "Link Agent",
      instructions: LINK_AGENT_INSTRUCTIONS,
      model: process.env.MODEL_NAME,
      mcpServers: [braveServer],
      tools: [validateLinksTool],
    });

    this.#searchAgent = new Agent({
      name: "Search Agent",
      instructions: SEARCH_AGENT_INSTRUCTIONS,
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
  }

  async search(query) {
    logger.debug(`search() called with query: ${query}`);
    await this.#init();
    const result = await this.#invoke(this.#searchAgent, query);
    let raw = String(result.finalOutput || "").trim();
    logger.debug(`Agent raw output (first 200 chars):`, raw.slice(0, 200));
    const out = this.#parseJSON(raw, BooksSchema);
    logger.debug(`Parsed ${out.books.length} books successfully`);
    return out.books;
  }

  async fetchLinks(query) {
    logger.debug(`fetchLinks() called with query: ${query}`);

    const initStart = Date.now();
    await this.#init();
    logger.debug(`Init check took: ${Date.now() - initStart}ms`);

    const invokeStart = Date.now();
    const result = await this.#invoke(this.#linkAgent, query);
    logger.debug(`Agent invocation took: ${Date.now() - invokeStart}ms`);

    let raw = String(result.finalOutput || "").trim();
    logger.debug(`Agent raw output (first 200 chars):`, raw.slice(0, 200));

    const out = this.#parseJSON(raw, LinksSchema);
    logger.debug(`Parsed ${out.links.length} links successfully`);
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
