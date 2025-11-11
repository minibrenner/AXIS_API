"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
// apps/api/src/config/env.ts
const dotenv_1 = require("dotenv");
const node_path_1 = require("node:path");
// O .env está em ../.env em relação a apps/api
(0, dotenv_1.config)({ path: (0, node_path_1.resolve)(process.cwd(), '../.env') });
function required(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return value;
}
exports.env = {
    JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
    JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
    JWT_ACCESS_TTL: required('JWT_ACCESS_TTL'), // ex.: "15m"
    JWT_REFRESH_TTL: required('JWT_REFRESH_TTL'), // ex.: "7d"
};
//# sourceMappingURL=env.js.map