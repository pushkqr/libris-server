const crypto = require("crypto");

const books = [];

class Book {
  #id;
  #title;
  #author;
  #edition;
  #overview;

  constructor(book) {
    this.#title = book.title;
    this.#author = book.author;
    this.#edition = book.edition;
    this.#overview = book.overview;
    this.#id = this.#generateId();
  }

  #generateId() {
    const normalized = `${this.#title}|${this.#author}|${this.#edition}`
      .toLowerCase()
      .trim();

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
  getOverview() {
    return this.#overview;
  }

  toJSON() {
    return {
      id: this.#id,
      title: this.#title,
      author: this.#author,
      edition: this.#edition,
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
