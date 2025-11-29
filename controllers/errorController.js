const errorController = function (err, req, res, next) {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
};

const notFoundController = function (req, res) {
  res.status(404).json({ error: "Route not found" });
};

module.exports = {
  errorController: errorController,
  notFoundController: notFoundController,
};
