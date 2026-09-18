import { pathToFileURL } from "node:url";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const [, , sourceArg, outputArg] = process.argv;

if (!sourceArg || !outputArg) {
  throw new Error("Usage: node render_tagged_pdf.mjs <source.html> <output.pdf>");
}

const source = path.resolve(sourceArg);
const output = path.resolve(outputArg);
await mkdir(path.dirname(output), { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 1697 },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(source).href, { waitUntil: "networkidle" });
  await page.emulateMedia({ media: "print", colorScheme: "light" });
  await page.pdf({
    path: output,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    tagged: true,
    outline: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
} finally {
  await browser.close();
}

console.log(output);
