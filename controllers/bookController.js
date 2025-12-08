const Book = require("./../models/book");
const getAgent = require("./../agent");

const getBookById = function (req, res, next) {
  try {
    const book = Book.fetchById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }
    return res.status(200).json(book);
  } catch (error) {
    next(error);
  }
};

const deleteBookById = function (req, res, next) {
  try {
    const deleted = Book.deleteById(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Book Not Found" });
    }

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const getBookLinks = async (req, res, next) => {
  try {
    const { id } = req.params;
    const book = Book.fetchById(id);

    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }

    if (process.env.DEBUG === "true") {
      console.log(
        `[DEBUG] Fetching links for book: ${book.title} by ${book.author}`
      );
    }

    let links = [];

    if (book.download && book.download.length > 0) {
      links = book.download;
      if (process.env.DEBUG === "true") {
        console.log(`[DEBUG] Using cached links for book ${id}`);
      }
    } else {
      const agent = await getAgent();
      links = await agent.fetchLinks(`${book.title} ${book.author}`);
      Book.updateDownloadLinks(id, links);
    }

    if (process.env.DEBUG === "true") {
      console.log(`[DEBUG] Found ${links.length} links for book ${id}`);
    }

    res.json({ links });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBookById: getBookById,
  deleteBookById: deleteBookById,
  downloadBook: getBookLinks,
};
