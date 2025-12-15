const Book = require("../models/book");
const getAgent = require("../agent");
const { HTTP_STATUS, logger } = require("../utils.js");

const getBookByHash = async function (req, res, next) {
  try {
    const book = await Book.fetchByHash(req.params.hash);
    if (!book) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ error: "Book not found" });
    }
    return res.status(HTTP_STATUS.OK).json(book);
  } catch (error) {
    next(error);
  }
};

const deleteBookByHash = async function (req, res, next) {
  try {
    const deleted = await Book.deleteByHash(req.params.hash);
    if (!deleted) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ error: "Book Not Found" });
    }

    return res.status(HTTP_STATUS.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
};

const getBookLinks = async (req, res, next) => {
  try {
    const { hash } = req.params;
    const book = await Book.fetchByHash(hash);

    if (!book) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ error: "Book not found" });
    }

    logger.debug(
      `[DEBUG] Fetching links for book: ${book.title} by ${book.author}`
    );

    let links = [];

    if (book.download && book.download.length > 0) {
      links = book.download;
      logger.debug(`[DEBUG] Using cached links for book ${hash}`);
    } else {
      const agent = await getAgent();
      links = await agent.fetchLinks(`${book.title} ${book.author}`);
      await Book.updateDownloadLinks(hash, links);
    }

    logger.debug(`[DEBUG] Found ${links.length} links for book ${hash}`);

    res.status(HTTP_STATUS.OK).json({ links });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBookByHash: getBookByHash,
  deleteBookByHash: deleteBookByHash,
  downloadBook: getBookLinks,
};
