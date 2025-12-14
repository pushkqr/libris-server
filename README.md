# Libris Server

A smart book search and management backend powered by OpenAI Agents and Google Gemini.

## Features

- **AI Search**: Intelligent book discovery using OpenLibrary & Gemini.
- **PDF Finder**: Auto-discovery of valid PDF download links.
- **Management**: Bookmark, retrieve, and delete books.
- **Metadata**: Automatic enrichment (covers, overviews, genres).

## Tech Stack

- **Core**: Node.js, Express.js
- **AI**: `@openai/agents`, Google Gemini (via OpenAI-compatible API)
- **Tools**: OpenLibrary API, Brave Search, Serper, Zod, Dotenv

## Quick Start

1. **Clone & Install**

   ```bash
   git clone https://github.com/pushkqr/libris-server.git
   cd libris-server
   npm install
   ```

2. **Configure Environment**
   Create a `.env` file:

   ```env
   PORT=8080
   DEBUG=true
   BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
   API_KEY=your_google_ai_key
   MODEL_NAME=gemini-2.0-flash-exp
   BRAVE_API_KEY=your_brave_key
   SERPER_API_KEY=your_serper_key
   DB_URL=your_db_uri
   ```

3. **Run**
   ```bash
   npm start
   ```

## API Endpoints

| Method   | Endpoint                       | Description      |
| -------- | ------------------------------ | ---------------- |
| `GET`    | `/api/v2/books?q=...`          | Search for books |
| `POST`   | `/api/v2/books`                | Bookmark a book  |
| `GET`    | `/api/v2/books/:hash`          | Get book details |
| `DELETE` | `/api/v2/books/:hash`          | Delete a book    |
| `GET`    | `/api/v2/books/:hash/download` | Find PDF links   |
