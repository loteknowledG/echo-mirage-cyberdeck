#!/usr/bin/env node
const html = await (await fetch("https://1lineart.kulaone.com/")).text();
const scripts = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
console.log("scripts:", scripts);
for (const src of scripts) {
  const url = src.startsWith("http") ? src : `https://1lineart.kulaone.com${src.startsWith("/") ? "" : "/"}${src}`;
  try {
    const body = await (await fetch(url)).text();
    if (body.length < 500000 && (body.includes("title") || body.includes("ascii"))) {
      console.log(url, "len", body.length, body.slice(0, 200));
    } else if (body.includes("Lenny") || body.includes("Shrug") || body.includes("content")) {
      console.log("hit", url, body.length);
      const idx = body.indexOf("Shrug") || body.indexOf("title");
      console.log(body.slice(Math.max(0, idx - 100), idx + 300));
    }
  } catch (e) {
    console.log(url, e.message);
  }
}
