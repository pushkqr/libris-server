const { z } = require("zod");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

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

const BookODM = new Schema({
  hash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  author: {
    type: String,
    required: true,
  },
  overview: {
    type: String,
  },
  coverUrl: {
    type: String,
    required: true,
  },
  isbn: {
    type: String,
    required: true,
  },
  year: {
    type: String,
    required: true,
  },
  genre: {
    type: Array,
    required: true,
  },
  pages: {
    type: String,
    required: true,
  },
  download: {
    type: Array,
  },
  cachedForQueries: [
    {
      type: Array,
    },
  ],
});

BookODM.index({
  title: "text",
  author: "text",
  overview: "text",
  isbn: "text",
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

module.exports = {
  SEARCH_AGENT_INSTRUCTIONS,
  LINK_AGENT_INSTRUCTIONS,
  LinksSchema,
  BookSchema,
  BooksSchema,
  BookODM,
};
