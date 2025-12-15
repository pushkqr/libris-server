const mongoose = require("mongoose");
const crypto = require("crypto");
const { BookODM } = require("../config.js");

const bookModel = mongoose.models.Book || mongoose.model("Book", BookODM);

class Book {
  #title;
  #author;
  #coverUrl;
  #overview;
  #isbn;
  #genre;
  #year;
  #pages;
  #hash;
  #publisher;
  #download = [];

  static PLACEHOLDER =
    "https://rhbooks.com.ng/wp-content/uploads/2022/03/book-placeholder.png";

  constructor(book) {
    this.#title = book.title;
    this.#author = book.author;
    this.#overview = book.overview || "";
    this.#coverUrl = book.coverUrl || Book.PLACEHOLDER;
    this.#isbn = book.isbn || "";
    this.#year = book.year || "";
    this.#genre = Array.isArray(book.genre) ? book.genre : [];
    this.#pages = book.pages || "";
    this.#publisher = book.publisher || "";
    this.#hash = this.#generateHash();
  }

  #generateHash() {
    const normalized = `${this.#title}|${this.#author}`.toLowerCase().trim();
    return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
  }

  getHash() {
    return this.#hash;
  }
  getTitle() {
    return this.#title;
  }
  getAuthor() {
    return this.#author;
  }
  getCoverURL() {
    return this.#coverUrl;
  }
  getOverview() {
    return this.#overview;
  }
  getISBN() {
    return this.#isbn;
  }
  getGenre() {
    return this.#genre;
  }
  getPages() {
    return this.#pages;
  }
  getYear() {
    return this.#year;
  }
  getPublisher() {
    return this.#publisher;
  }
  getDownload() {
    return this.#download;
  }

  setDownload(links) {
    this.#download = links;
  }

  static parse(book) {
    return {
      hash: book.hash,
      title: book.title,
      author: book.author,
      coverUrl: book.coverUrl,
      overview: book.overview,
      genre: book.genre,
      isbn: book.isbn,
      pages: book.pages,
      year: book.year,
      publisher: book.publisher,
      download: book.download,
    };
  }

  toJSON() {
    return {
      hash: this.#hash,
      title: this.#title,
      author: this.#author,
      coverUrl: this.#coverUrl,
      overview: this.#overview,
      genre: this.#genre,
      isbn: this.#isbn,
      pages: this.#pages,
      year: this.#year,
      publisher: this.#publisher,
      download: this.#download,
    };
  }

  static async fetchAll() {
    const books = await bookModel.find();
    return books.map((b) => Book.parse(b));
  }

  static async fetchByHash(hash) {
    const book = await bookModel.findOne({ hash: hash });
    if (!book) return null;
    return Book.parse(book);
  }

  static async fetchByExactQuery(query) {
    const normalizedQuery = query.toLowerCase().trim();
    const books = await bookModel.find({
      cachedForQueries: normalizedQuery,
    });
    return books.map((b) => Book.parse(b));
  }

  static async searchByText(query, limit = 10) {
    const books = await bookModel
      .find({ $text: { $search: query } })
      .sort({ score: { $meta: "textScore" } })
      .limit(limit);
    return books.map((b) => Book.parse(b));
  }

  static async saveWithQueryCache(bookData, query) {
    const normalizedQuery = query.toLowerCase().trim();
    await bookModel.findOneAndUpdate(
      { hash: bookData.hash },
      {
        ...bookData,
        $addToSet: { cachedForQueries: normalizedQuery },
      },
      { upsert: true, new: true }
    );
  }

  static async deleteByHash(hash) {
    const res = await bookModel.findOneAndDelete({ hash: hash });
    if (res) {
      return true;
    }
    return false;
  }

  static async updateDownloadLinks(hash, links) {
    await bookModel.findOneAndUpdate(
      { hash: hash },
      { $set: { download: links } }
    );
  }

  async save() {
    await bookModel.findOneAndUpdate({ hash: this.#hash }, this.toJSON(), {
      upsert: true,
      new: true,
    });
  }
}

module.exports = Book;
