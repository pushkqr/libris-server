const logger = {
  debug: (...args) => {
    if (process.env.DEBUG === "true") {
      console.log("[DEBUG]", ...args);
    }
  },
  warn: (...args) => {
    if (process.env.DEBUG === "true") {
      console.warn("[DEBUG]", ...args);
    }
  },
  error: (...args) => {
    if (process.env.DEBUG === "true") {
      console.error("[DEBUG]", ...args);
    }
  },
};

const normalizeQuery = function (query) {
  return query
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
};

const sanitizeText = (text) => {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ")
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .trim();
};

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};

module.exports = {
  logger,
  normalizeQuery,
  sanitizeText,
  HTTP_STATUS,
};
