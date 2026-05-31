/**
 * Step 10 — validate quoteSummary fields available for index ETFs and credit ETFs
 */
import { default as YF } from "yahoo-finance2";
const yf = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TICKERS = [
  ["SPY",  "S&P 500 ETF"],
  ["QQQ",  "Nasdaq 100 ETF"],
  ["IWM",  "Russell 2000 ETF"],
  ["EFA",  "Intl Developed ETF"],
  ["EEM",  "Emerging Markets ETF"],
  ["LQD",  "IG Credit ETF"],
  ["HYG",  "HY Credit ETF"],
  ["EMB",  "EM USD Sovereign"],
  ["EMLC", "EM Local Currency"],
];

for (const [ticker, label] of TICKERS) {
  try {
    const r = await yf.quoteSummary(ticker, {
      modules: ["summaryDetail", "defaultKeyStatistics"],
    });
    const sd = r.summaryDetail ?? {};
    const ks = r.defaultKeyStatistics ?? {};
    console.log(`\n── ${ticker} (${label})`);
    console.log(`   trailingPE   : ${sd.trailingPE ?? "—"}`);
    console.log(`   forwardPE    : ${sd.forwardPE ?? "—"}`);
    console.log(`   priceToBook  : ${sd.priceToBook ?? ks.priceToBook ?? "—"}`);
    console.log(`   yield        : ${sd.yield != null ? (sd.yield * 100).toFixed(2) + "%" : "—"}`);
    console.log(`   dividendYield: ${sd.dividendYield != null ? (sd.dividendYield * 100).toFixed(2) + "%" : "—"}`);
    console.log(`   beta         : ${sd.beta ?? "—"}`);
    console.log(`   pegRatio     : ${ks.pegRatio ?? "—"}`);
  } catch (e) {
    console.log(`\n── ${ticker}: ERROR — ${e.message.slice(0,80)}`);
  }
  await sleep(300);
}
