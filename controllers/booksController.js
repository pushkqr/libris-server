const getAgent = require("../agent");
const Book = require("../models/book");
const { logger, normalizeQuery, HTTP_STATUS } = require("../utils.js");

const getBooks = async function (req, res, next) {
  try {
    let { search } = req.query;
    if (!search) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ error: "Search query required" });
    }

    search = normalizeQuery(search);
    let cachedResults = await Book.fetchByExactQuery(search);
    if (cachedResults.length > 0) {
      logger.debug(
        `[EXACT CACHE HIT] ${cachedResults.length} results for: "${search}"`
      );
      return res.status(HTTP_STATUS.OK).json(cachedResults);
    }

    cachedResults = await Book.searchByText(search);

    if (cachedResults.length >= 3) {
      logger.debug(
        `[TEXT SEARCH HIT] ${cachedResults.length} results for: "${search}"`
      );
      return res.status(HTTP_STATUS.OK).json(cachedResults);
    }

    logger.debug(`[CACHE MISS] Agent search for: "${search}"`);
    const agent = await getAgent();
    let result = await agent.search(search);

    result = await Promise.all(
      result.map(async (b) => {
        const book = new Book(b);
        await Book.saveWithQueryCache(book.toJSON(), search);
        return book.toJSON();
      })
    );

    logger.debug("Search result:", result);

    return res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};

const postBook = async function (req, res, next) {
  try {
    const { title, author, edition, isbn, coverUrl, overview } = req.body;

    if (!title || !author) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ error: "Title and author required" });
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
    logger.debug(
      `[DEBUG] Book saved: ${book.getTitle()} (ISBN: ${book.getHash()})`
    );

    if (before)
      return res
        .status(HTTP_STATUS.CONFLICT)
        .json({ error: "Book already exists", isbn: book.getHash() });

    return res.status(HTTP_STATUS.CREATED).json({
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
