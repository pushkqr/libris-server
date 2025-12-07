const express = require("express");
const booksController = require("../controllers/booksController");
const bookController = require("../controllers/bookController");
const router = express.Router();

router.get("/", booksController.searchBooks);
router.post("/", booksController.addBook);

router.get("/:id", bookController.getBookById);
router.delete("/:id", bookController.deleteBookById);
router.get("/:id/download", bookController.downloadBook);

module.exports = router;
