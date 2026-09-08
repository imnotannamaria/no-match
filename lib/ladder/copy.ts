// Every string the ladder puts in front of a person. Kept in one file so
// it can be read end to end as prose, which is the only way to catch a
// stage explanation that names an option without saying what it does.
//
// CLAUDE.md: interface text is part of the product, not a caption. Written
// for someone who has never heard the word "token".

import type { Fix } from "@/lib/ladder/fix";
import type { LadderVerdict, StageId } from "@/lib/ladder/types";

interface StageCopy {
  /** The option to turn on to reach this stage. Empty when there is nothing to turn on. */
  option: string;
  /** What that option does, in plain words, with a concrete example where one helps. */
  does: string;
}

export const STAGE_COPY: Record<StageId, StageCopy> = {
  S0: {
    option: "",
    does: "só quebra o texto em palavras, sem mudar nenhuma delas",
  },
  S1: {
    option: "case_sensitive: false",
    does: "deixa tudo minúsculo, então Café e café viram a mesma palavra",
  },
  S2: {
    option: "remove_stopwords",
    does: "descarta palavras muito comuns, como de, da, o",
  },
  S3: {
    option: "stemming",
    does: "corta a palavra até a raiz, então correr e correu viram corr",
  },
  S4: {
    option: "ascii_folding",
    does: "troca letra acentuada pela sem acento, então café vira cafe",
  },
};

export const VERDICT_COPY: Record<LadderVerdict, string> = {
  match: "iguais",
  "no-match": "diferentes",
  "doc-dropped": "o documento perdeu a palavra aqui",
  "query-dropped": "a busca perdeu a palavra aqui",
  "both-dropped": "os dois perderam a palavra aqui",
};

/** "S4 · ascii_folding", or just "S0" when the stage turns nothing on. */
export function stageLabel(stage: StageId): string {
  const { option } = STAGE_COPY[stage];
  return option ? `${stage} · ${option}` : stage;
}

/** What to do about a pair that only becomes equal at `stage`. */
export function convergeAdvice(stage: StageId): string {
  const { option, does } = STAGE_COPY[stage];
  if (!option) {
    return "as duas palavras já são iguais sem ligar nada. Se o documento não voltou, o motivo não está nesta palavra.";
  }
  if (stage === "S1") {
    return `só a caixa das letras difere, e ${option} já é o padrão. Se o documento não voltou, o motivo não está nesta palavra.`;
  }
  return `Ligue ${option}, que ${does}.`;
}

/** What to say when a filter ate the document's copy of the word. */
export function disappearedAdvice(stage: StageId, word: string): string {
  const { option, does } = STAGE_COPY[stage];
  return `o documento tem exatamente essa palavra. Só que ${option} ${does}, e "${word}" é uma delas. Desligue ${option} para achar este documento.`;
}

/** Names the option that actually fixes the pair, and what it does. */
export function optionAdvice(option: "ascii_folding" | "stemming"): string {
  const stage = option === "ascii_folding" ? "S4" : "S3";
  return `Ligue ${option}, que ${STAGE_COPY[stage].does}.`;
}

export const NEVER_ADVICE =
  "nenhuma palavra deste documento vira igual a essa, em nenhum estágio. Não é configuração: são palavras diferentes mesmo.";

/** The word never entered the search, so no document could ever match on it. */
export function droppedFromQueryAdvice(reason: "stopword" | "length", bytes: number, limit: number): string {
  if (reason === "length") {
    return `essa palavra tem ${bytes} bytes, acima do limite de ${limit}, então ela foi descartada da sua busca antes de comparar com qualquer documento.`;
  }
  return "essa palavra é comum demais e remove_stopwords descartou ela da sua própria busca, antes de comparar com qualquer documento. Nenhum documento poderia bater por ela.";
}

export const PHRASE_ONLY_MISS =
  "todas as palavras da busca estão neste documento, mas não uma do lado da outra. Nenhum estágio da análise tirou ele: foi a frase exata. Desligue frase exata para trazer este documento de volta.";

/** The toggles, in the order the cascade applies them. */
export const OPTION_COPY: {
  key: "case_sensitive" | "remove_stopwords" | "stemming" | "ascii_folding";
  help: string;
}[] = [
  { key: "case_sensitive", help: "diferencia maiúscula de minúscula" },
  { key: "remove_stopwords", help: "descarta palavras muito comuns, como de, da, o" },
  { key: "stemming", help: "corta a palavra até a raiz, correr e correu viram corr" },
  { key: "ascii_folding", help: "tira o acento, café vira cafe" },
];

/** What the fix button says, naming both the change and where it lands. */
export function fixLabel(fix: Fix, target: string): string {
  switch (fix.kind) {
    case "enable":
      return `ligar ${fix.option} na coluna ${target}`;
    case "disable":
      return `desligar ${fix.option} na coluna ${target}`;
    case "disable-phrase":
      return `desligar frase exata na coluna ${target}`;
    case "raise-max-token-length":
      return `subir max_token_length para ${fix.to} na coluna ${target}`;
  }
}
