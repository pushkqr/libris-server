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

const book = new Book({
  title: "Computer Networks",
  author: "Andrew S. Tanenbaum, David J. Wetherall",
  edition: "5th edition",
  overview:
    "This textbook provides a structured approach to explaining how networks work from the inside out. It covers key principles and illustrates them using real-world examples such as the Internet, Wireless LANs, broadband wireless, and Bluetooth. The fifth edition includes a dedicated chapter on network security and is suitable for both undergraduate and graduate-level courses.",
});
book.save();
console.log(book.getId());

app.use("/api/v2/books", booksRouter);
app.use(errorController);
app.use(notFoundController);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
