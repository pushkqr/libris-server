const cors = require("cors");
const express = require("express");
const Book = require("./models/book");
const booksRouter = require("./routes/booksRouter");
// const bookRouter = require("./routes/bookRouter");
const {
  errorController,
  notFoundController,
} = require("./controllers/errorController");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// const book = new Book({
//   title: "Computer Networks",
//   author: "Andrew S. Tanenbaum, David J. Wetherall",
//   edition: "5th edition",
//   coverUrl: "https://covers.openlibrary.org/b/isbn/978-0132126953-L.jpg",
//   overview:
//     "This textbook provides a structured approach to explaining how networks work from the inside out...",
// });
// book.save();
// console.log(book.getISBN());

app.use("/api/v2/books", booksRouter);
app.use(errorController);
app.use(notFoundController);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
