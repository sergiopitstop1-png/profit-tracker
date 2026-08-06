import React from "react";

// Trasforma il testo scritto nel pannello admin nello stesso stile visivo
// degli articoli esistenti. Regole (vedi anche la guida nel pannello):
//
//   ## Titolo sezione        → intestazione grande (come "La Spagna torna sul trono")
//   > testo evidenziato      → box arancione in risalto (come l'introduzione)
//   - voce 1                 → elenco puntato
//   - voce 2
//   **testo**                → grassetto
//   (riga vuota = nuovo paragrafo)
//
export function renderArticleContent(content: string): React.ReactNode[] {
  if (!content) return [];
  const blocks = content.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length > 0) {
      elements.push(
        <ul key={key} className="mt-6 list-disc space-y-2 pl-6 leading-8 text-white/70">
          {listBuffer.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
  };

  blocks.forEach((block, i) => {
    const isList = block.split("\n").every((l) => l.trim().startsWith("- "));

    if (block.startsWith("## ")) {
      flushList(`list-${i}`);
      elements.push(
        <h2 key={i} className="mt-16 text-3xl font-bold">
          {block.slice(3).trim()}
        </h2>
      );
    } else if (block.startsWith(">")) {
      flushList(`list-${i}`);
      const text = block
        .split("\n")
        .map((l) => l.replace(/^>\s?/, ""))
        .join(" ");
      elements.push(
        <div key={i} className="mt-10 rounded-3xl border border-orange-400/20 bg-orange-500/10 p-8">
          <p className="text-xl font-semibold leading-9">{renderInline(text)}</p>
        </div>
      );
    } else if (isList) {
      block.split("\n").forEach((l) => listBuffer.push(l.replace(/^- /, "").trim()));
    } else {
      flushList(`list-${i}`);
      elements.push(
        <p key={i} className="mt-6 leading-8 text-white/70">
          {renderInline(block)}
        </p>
      );
    }
  });
  flushList("list-end");
  return elements;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
