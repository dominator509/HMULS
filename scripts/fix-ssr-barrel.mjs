import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ssr = join(root, ".vercel/output/functions/__server.func/_ssr/ssr.mjs");
const ssr2 = join(root, ".vercel/output/functions/__server.func/_ssr/ssr2.mjs");
const libs = join(root, ".vercel/output/functions/__server.func/_libs");
const pgliteDist = join(root, "node_modules/@electric-sql/pglite/dist");

if (existsSync(ssr)) {
  let src = readFileSync(ssr, "utf8");
  if (src.includes("ssr_exports as s") && src.includes("server_default as default")) {
    src = src.replace("ssr_exports as s", "server_default as s");
    writeFileSync(ssr, src);
  }
}

if (existsSync(ssr2)) {
  let src = readFileSync(ssr2, "utf8");
  const cyclic = 'import { c as __exportAll$1 } from "./ssr.mjs";\n';
  if (src.includes(cyclic)) {
    const helper = `var __exportAll$1 = (all, no_symbols) => {
	let target = {};
	for (var name in all) Object.defineProperty(target, name, { get: all[name], enumerable: true });
	if (!no_symbols) Object.defineProperty(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
`;
    src = src.replace(cyclic, helper);
    writeFileSync(ssr2, src);
  }
}

if (existsSync(libs) && existsSync(pgliteDist)) {
  for (const name of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
    const from = join(pgliteDist, name);
    const to = join(libs, name);
    if (existsSync(from) && !existsSync(to)) copyFileSync(from, to);
  }
}
