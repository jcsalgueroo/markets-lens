import { default as YF } from "yahoo-finance2";

const yf = new YF();

// Test with a simple known ticker
const q = await yf.quote("^GSPC", {}, { validateResult: false });
console.log("Instance quote ^GSPC:", q.regularMarketPrice, q.shortName);

// Test first sector ticker
const s = await yf.quote("^SP500-45", {}, { validateResult: false });
console.log("Instance quote ^SP500-45:", s.regularMarketPrice, s.shortName);
