const getAgent = require("../agent");
const Book = require("../models/book");

const getBooks = async function (req, res, next) {
  try {
    const { search } = req.query;
    if (!search) {
      return res.status(400).json({ error: "Search query required" });
    }

    const agent = await getAgent();
    let result = await agent.search(search);

    result = await Promise.all(
      result.map(async (b) => {
        const book = new Book(b);
        await book.save();
        return book.toJSON();
      })
    );

    if (process.env.DEBUG === "true") {
      console.log("[DEBUG] Search result:", result);
    }

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const postBook = async function (req, res, next) {
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
    const before = await Book.fetchByHash(book.getHash());
    await book.save();
    if (process.env.DEBUG === "true") {
      console.log(
        `[DEBUG] Book saved: ${book.getTitle()} (ISBN: ${book.getISBN()})`
      );
    }
    if (before)
      return res
        .status(409)
        .json({ error: "Book already exists", isbn: book.getISBN() });

    return res.status(201).json({
      message: "Book added successfully",
      book: book.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchBooks: getBooks,
  addBook: postBook,
};
