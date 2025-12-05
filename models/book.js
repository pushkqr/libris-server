const crypto = require("crypto");

const books = [];

class Book {
  #title;
  #author;
  #coverUrl;
  #overview;
  #isbn;
  #genre;
  #year;
  #pages;
  #id;
  #publisher;

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
    this.#id = this.#generateId();
  }

  #generateId() {
    const normalized = `${this.#title}|${this.#author}|${this.#isbn}`
      .toLowerCase()
      .trim();

    return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
  }

  getId() {
    return this.#id;
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

  toJSON() {
    return {
      id: this.#id,
      title: this.#title,
      author: this.#author,
      coverUrl: this.#coverUrl,
      overview: this.#overview,
      genre: this.#genre,
      isbn: this.#isbn,
      pages: this.#pages,
      year: this.#year,
      publisher: this.#publisher,
    };
  }

  static fetchAll() {
    return books.map((b) => b.toJSON());
  }

  static fetchById(isbn) {
    const book = books.find((b) => b.getId() === isbn);

    if (!book) return null;

    return book.toJSON();
  }

  static deleteById(isbn) {
    const idx = books.findIndex((b) => b.getId() === isbn);

    if (idx !== -1) {
      books.splice(idx, 1);
      return true;
    }

    return false;
  }

  save() {
    if (!books.find((b) => b.getId() === this.getId())) {
      books.push(this);
    }
  }
}

module.exports = Book;
