const express = require("express");
const booksController = require("../controllers/booksController");
const bookController = require("../controllers/bookController");
const router = express.Router();

router.get("/", booksController.searchBooks);
router.post("/", booksController.addBook);

router.get("/:hash", bookController.getBookByHash);
router.delete("/:hash", bookController.deleteBookByHash);
router.get("/:hash/download", bookController.downloadBook);

module.exports = router;
