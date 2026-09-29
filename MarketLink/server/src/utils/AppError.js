// An error with an HTTP status code. Thrown from controllers and turned into
// a JSON response by the error-handling middleware.
export default class AppError extends Error {
  constructor(message, statusCode = 400, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}
