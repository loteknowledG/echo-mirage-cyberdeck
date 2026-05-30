#!/usr/bin/env node
const html = await (await fetch("https://asky.lol/")).text();
const scripts = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
console.log("scripts:", scripts);
for (const src of scripts) {
  const url = src.startsWith("http") ? src : `https://asky.lol${src.startsWith("/") ? "" : "/"}${src}`;
  const js = await (await fetch(url)).text();
  if (js.includes("Flip All Tables") || js.includes("Lenny")) {
    console.log("found data in", url, "len", js.length);
    const m = js.match(/\[{[^\]]*name[^\]]*}\]/);
    console.log("array sample", m?.[0]?.slice(0, 300));
  }
}
