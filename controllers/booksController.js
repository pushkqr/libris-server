const getAgent = require("../agent");
const Book = require("../models/book");

const getBooks = async function (req, res, next) {
  try {
    const { search } = req.query;
    if (!search) {
      return res.status(400).json({ error: "Search query required" });
    }

    const agent = await getAgent();
    const result = await agent.search(search);
    console.log(result);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const postBook = function (req, res, next) {
  try {
    const { title, author, edition, isbn, coverUrl, overview } = req.body;

    if (!title || !author) {
      return res.status(400).json({ error: "Title and author required" });
    }

    const book = new Book({
      title,
      author,
      coverUrl: coverUrl,
      edition: edition || "",
      isbn: isbn || "",
      overview: overview || "",
    });
    const before = Book.fetchById(book.getId());
    book.save();
    if (before)
      return res
        .status(409)
        .json({ error: "Book already exists", id: book.getId() });

    return res.status(201).json({
      message: "Book added successfully",
      book: {
        id: book.getId(),
        title: book.getTitle(),
        author: book.getAuthor(),
        edition: book.getEdition(),
        overview: book.getOverview(),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchBooks: getBooks,
  addBook: postBook,
};
