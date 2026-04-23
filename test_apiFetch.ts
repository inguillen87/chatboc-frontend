import { ApiError } from './src/utils/api';
const err = new ApiError("test error", 400, { data: "test" }, "req-123");
console.log(err.message, err.status, err.requestId);
