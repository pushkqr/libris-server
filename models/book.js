const crypto = require("crypto");

const books = [];

class Book {
  #id;
  #title;
  #author;
  #edition;
  #isbn;
  #coverUrl;
  #overview;

  static PLACEHOLDER =
    "https://rhbooks.com.ng/wp-content/uploads/2022/03/book-placeholder.png";

  constructor(book) {
    this.#title = book.title;
    this.#author = book.author;
    this.#edition = book.edition;
    this.#isbn = book.isbn;
    this.#coverUrl = book.coverUrl;
    this.#overview = book.overview;
    this.#id = this.#generateId();
  }

  #generateId() {
    const normalized = `${this.#title}|${this.#author}`.toLowerCase().trim();

    const hash = crypto
      .createHash("sha256")
      .update(normalized, "utf8")
      .digest("hex");

    return hash;
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
  getEdition() {
    return this.#edition;
  }
  getISBN() {
    return this.#isbn;
  }
  getCoverURL() {
    return this.#coverUrl;
  }
  getOverview() {
    return this.#overview;
  }

  toJSON() {
    return {
      id: this.#id,
      title: this.#title,
      author: this.#author,
      edition: this.#edition,
      isbn: this.#isbn,
      coverUrl: this.#coverUrl,
      overview: this.#overview,
    };
  }

  static fetchAll() {
    return books.map((b) => b.toJSON());
  }

  static fetchById(id) {
    const book = books.find((b) => b.getId() === id);

    if (!book) return null;

    return book.toJSON();
  }

  static deleteById(id) {
    const idx = books.findIndex((b) => b.getId() === id);

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
