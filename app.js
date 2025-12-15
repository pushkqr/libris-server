const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");

const { logger } = require("./utils.js");
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

  try {
    await mongoose.connect(process.env.DB_URL, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("Connected to MongoDB");
  } catch (error) {
    throw Error("Failed to connect to mongoDB.");
  }

  try {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    throw Error(`Failed to launch server on port ${PORT},`);
  }
}

app.use("/api/v2/books", booksRouter);
app.use(errorController);
app.use(notFoundController);

invokeServer()
  .then()
  .catch((err) => logger.error(err));

module.exports = app;
