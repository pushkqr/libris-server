const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");

const Book = require("./models/book");
const booksRouter = require("./routes/booksRouter");
const {
  errorController,
  notFoundController,
} = require("./controllers/errorController");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

async function invokeServer() {
  const PORT = process.env.PORT || 8080;
  await mongoose.connect(process.env.DB_URL, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log("Connected to MongoDB");
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

app.use("/api/v2/books", booksRouter);
app.use(errorController);
app.use(notFoundController);

invokeServer()
  .then()
  .catch((err) => console.error(err));

module.exports = app;
