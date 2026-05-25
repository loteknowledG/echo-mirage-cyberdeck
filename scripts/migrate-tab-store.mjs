import fs from "fs";

const path = "src/app/cyberdeck/page.tsx";
let s = fs.readFileSync(path, "utf8");

s = s.replace(
  /  const \[server, setServer\] = useState<\(typeof SERVER_IDS\)\[number\]>\("m"\);\r?\n  const \[customTabs, setCustomTabs\] = useState<CustomTab\[\]>\(\[\]\);\r?\n  const \[activeCustomTabId, setActiveCustomTabId\] = useState<string \| null>\(null\);\r?\n  const \[optimisticRailTabId, setOptimisticRailTabId\] = useState<string \| null>\(null\);\r?\n  const \[, startTabTransition\] = useTransition\(\);\r?\n/,
  "  // Tab rail + pane visibility: zustand store (page must not subscribe).\n",
);

const replacers = [
  [/\bsetServer\(/g, "useCyberdeckTabStore.getState().setServer("],
  [/\bsetCustomTabs\(/g, "useCyberdeckTabStore.getState().setCustomTabs("],
  [/\bsetActiveCustomTabId\(/g, "useCyberdeckTabStore.getState().setActiveCustomTabId("],
];

for (const [re, rep] of replacers) {
  s = s.replace(re, rep);
}

fs.writeFileSync(path, s);
console.log("migrated setters");
