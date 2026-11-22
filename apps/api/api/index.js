// Vercel Serverless Entry Point (plain JS — no TypeScript compilation by Vercel)
// tsc runs first via buildCommand in vercel.json and produces dist/index.js
const app = require('../dist/index').default;

module.exports = function handler(req, res) {
  return app(req, res);
};
