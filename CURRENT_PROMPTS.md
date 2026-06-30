# 当前生成与检查 Prompt 清单

来源文件：`server.js`

说明：
- `{...}` 表示运行时变量。
- “约束”类文本不是独立接口，但会拼到正文生成 prompt 的末尾重新调用模型。
- 纯代码校验不属于 prompt，例如 `findMissingWords`、`findUnexpectedEnglishTokens`、`findOverusedWords`、`computeSparseIssues`。

## 1. 词库生成：`lexicon_core` / `lexicon`

Core 版：

```text
You are an IELTS vocabulary assistant.
Return ONLY JSON array.
Each item format:
{"word": string, "pos": string, "us_ipa": string, "uk_ipa": string, "meanings": string[]}
Rules:
1) Keep same order as input words.
2) pos should be concise (e.g. n., v., adj., adv.).
3) meanings should be concise Chinese meanings, 1-3 items, ordered by IELTS frequency.
4) meanings[0] MUST be the single most common IELTS exam sense.
5) Avoid rare/archaic niche senses unless absolutely necessary.
6) Prioritize meanings useful for reading/listening/writing tasks.
Words: {chunkWords}
```

Full 版：

```text
You are an IELTS vocabulary assistant.
Return ONLY JSON array.
Each item format:
{"word": string, "pos": string, "us_ipa": string, "uk_ipa": string, "meanings": string[], "collocations": string[], "word_formation": string, "synonyms": string[], "antonyms": string[]}
Rules:
1) Keep same order as input words.
2) pos should be concise (e.g. n., v., adj., adv.).
3) meanings should be concise Chinese meanings, 1-3 items, ordered by IELTS frequency.
4) meanings[0] MUST be the single most common IELTS exam sense.
5) Avoid rare/archaic niche senses unless absolutely necessary.
6) Prioritize meanings useful for reading/listening/writing tasks.
7) collocations should be common IELTS-friendly phrase combinations (English phrase + concise Chinese).
8) word_formation should include root/prefix/suffix notes when useful.
9) synonyms/antonyms should be common high-frequency exam words.
10) Keep definitions practical and exam-usable; avoid overly technical senses.
Words: {chunkWords}
```

## 2. 词库 JSON 重试：`lexicon_core_retry` / `lexicon_retry`

```text
Return ONLY JSON array, no markdown, no explanation.
Each item keys must be exactly: {core/full keys}.
Keep same order as input words.
Words: {chunkWords}
```

## 3. 词库兜底：`lexicon_core_fallback` / `lexicon_fallback`

```text
You are an IELTS vocabulary assistant.
Return ONLY JSON array.
For each word provide practical IELTS meanings and basic word data.
Output format: {core/full output format}
meanings[0] MUST be the most common IELTS sense.
Order meanings by IELTS frequency descending.
If a word is misspelled, infer the most likely intended word and still provide useful meanings for the given spelling.
Words: {failedWords}
```

## 4. 混合短文用法规划：`mixed_plan`

```text
You are planning natural usage for a Chinese-first mixed-language passage.
The final target style is a fluent Chinese mini-scene with only the supplied English words embedded, e.g. 清晨，我们沿着由granite构成的山路前进，脚下的terrain起伏不平。
Plan for DIRECT mixed-language writing. Do not plan a Chinese draft to be translated later.
Coverage has highest priority: every input word must have a natural slot in the final passage.
First infer the overall theme of the word list. Examples: natural geography, weather/climate, emotion/psychology, campus life, technology/society, abstract concepts.
If most words share a theme, choose one coherent scene around that theme.
If the words are random, create one plausible story scene that can naturally contain all of them.
For random words like apple/thunder/library/dragon/nervous/machine, a good scene is: a student studies in a library during thunder, eats an apple, reads a dragon story, hears a machine, and feels nervous.
Arrange words by story logic, not by input order: background -> place -> action -> change/conflict -> result -> feeling/summary.
For each word, choose a grammar role matching its POS: nouns as objects/places/items, verbs as actions, adjectives modifying Chinese nouns, academic terms in class/research contexts, abstract words in reflection.
Return ONLY JSON array in the same order as input words.
Each item format:
{"word": string, "pos": string, "meaning": string, "scene": string, "allowed_pattern": string, "avoid": string, "must_keep_english": boolean, "preferred_pattern": string, "forbidden_chinese_only": string[], "allowed_templates": string[]}
Rules:
1) meaning should be the most natural context-appropriate Chinese meaning for daily-life usage, not just dictionary default.
2) scene should be a short label for the shared theme/scene, e.g. geography-field-trip, storm-observation, campus-day, lab-accident, family-memory.
3) allowed_pattern should describe the natural Chinese grammar slot for this English word.
4) avoid should mention awkward/collocation mistakes to prevent forced usage.
5) Avoid isolated example sentences. Every word should belong to the same coherent passage whenever possible.
6) For must-keep words (...), set must_keep_english=true and provide preferred_pattern / forbidden_chinese_only / allowed_templates.
Words: {sourceWords}
Lexicon candidates:
{lexGuide}
```

## 5. 正文生成：`article`

普通英文文章模式：

```text
Write an English IELTS-style article.
Return ONLY JSON object:
{"title":"...", "article":"..."}
Level: {level}.
{lengthRule}
{paragraphRule}
Article must be plain text paragraphs separated by blank lines.
Every target word must appear at least once.
Use the most natural context-appropriate meaning for each word in the exact scene.
Naturalness is more important than using default dictionary sense.
Do not force a target word into an unnatural sentence just for coverage.
If a word is difficult to place naturally, put it in a separate short micro-scene.
Do not include sense markers in the article body.
The output should read smoothly even for someone who ignores the vocabulary-learning purpose.
Make title concise and natural.
Vocabulary guide:
{vocabGuide}
{extraConstraint}
```

混合短文模式：

```text
Write a Chinese-first mixed-language short passage. The backend will replace protected tokens with English words after generation.
Return ONLY valid JSON. Do not output markdown or explanations.
HARD RULES, highest priority:
1) Use every protected token exactly as written, such as ⟦T1⟧ and ⟦T2⟧.
2) Never translate, delete, rename, split, or modify protected tokens.
3) Do NOT write the real English target words directly in the article body; use protected tokens only.
4) All non-protected-token content in article must be Chinese.
5) Coverage of protected tokens is more important than naturalness; improve naturalness only after all protected tokens are included.
6) The first sentence must include at least one protected token; do not write a Chinese-only introduction.
7) If the article body has no protected token, the answer is invalid.
8) The JSON title must be Chinese in mixed mode.
Protected target guide:
{protectedTargetGuide}
Writing goal:
Write one coherent Chinese mini-scene, not isolated example sentences.
First infer the common domain of the protected tokens. If they share a domain, build the whole passage around that domain.
If the tokens are semantically random, create one believable daily-life, school, travel, field-trip, lab, or weather-observation scene that can contain them.
Arrange protected tokens by story logic rather than input order: background -> place -> action -> change/conflict -> result -> feeling/summary.
Place each protected token in a natural grammar slot based on its POS: noun as object/place/item/concept, verb as action/change, adjective before a Chinese noun, academic term in a class/research note, abstract word in reflection.
Use 6-10 natural Chinese sentences.
Prefer 1-3 protected tokens per sentence when they naturally belong together.
Do not add long Chinese-only setup before the first protected token.
Do not use glossary parentheses such as 中文（⟦T1⟧）.
Do not output Chinese meaning + protected token duplicates such as 残忍⟦T1⟧ or 无菌⟦T2⟧.
Do not output word lists, keyword sections, dictionary lines, or standalone examples.
When Chinese characters directly connect with a protected token, keep compact form like 看到⟦T1⟧ or 感到⟦T2⟧.
If a protected token is hard to place naturally, add a brief observation, notebook sentence, classroom remark, object, action, or feeling inside the same scene.
Return ONLY JSON object:
{"title":"...", "article":"..."}
Level: {level}.
Write one coherent short scene of 6-10 natural Chinese sentences.
Use 1-3 paragraphs separated by blank lines, with clear beginning, development, and ending.
Passage must be plain text paragraphs separated by blank lines.
Every protected token must appear in article exactly as written.
Use the context-appropriate meaning from the protected token guide.
Protected-token coverage is more important than naturalness.
Do not remove a hard protected token just because it is awkward; integrate it as a short observation inside the same scene.
If a protected token is difficult to place naturally, integrate it as a brief observation, classroom note, object, action, or reflection inside the same scene.
Do not include sense markers in the article body.
The output should read smoothly even for someone who ignores the vocabulary-learning purpose.
Make title concise and natural.
Protected token guide:
{protectedTargetGuide}
Mandatory target-word placement plan:
{requiredWordPlan}
Exact protected token checklist: {protectedTokenList}
Usage planning hints:
{usagePlanGuide}
{promptExtraConstraint}
```

## 6. 高密度混合模式追加约束：`mixed_dense` via `article`

```text
Write high-density Chinese mixed flow using protected tokens.
Use high-density mixed flow: prefer 4-8 short sentences, not a long narrative paragraph.
Use 4-8 short lines or short paragraphs, separated by blank lines when needed.
Prefer 1-2 protected tokens per sentence, and keep sentence units short.
Keep Chinese bridge text between adjacent protected tokens very short: ideal <=10 Chinese characters, hard limit <=18.
Avoid long Chinese-only paragraphs that push protected tokens far apart.
Prefer 4-8 short sentences instead of long paragraphs.
The first sentence must contain at least one protected token.
Do not begin with a standalone Chinese background paragraph.
Prefer the first protected token to appear within the first 12 Chinese characters.
Every sentence should be short and dense.
Do not write scene setup before using protected tokens.
```

## 7. 分块生成追加约束

```text
Dense chunk {i}/{total}.
Use ALL these target words in this chunk: {groupWords}.
The first sentence must contain at least one target word.
Do not write a long Chinese-only introduction before the first target word.
Before the first target word, allow at most 12 Chinese characters.
Start directly with the mixed content, not with background setup.
```

局部缺词重试：

```text
Important local fix: every target word in this chunk must appear as the exact English token.
Coverage is validated by exact literal English surface forms.
Chinese translation does NOT count as usage.
Never replace a target word with Chinese-only wording.
Missing local words: {localMissing}.
```

Micro-scene 约束：

```text
Micro-scene {i}/{total}.
Only focus on these target words in this part: {groupWords}.
Do not intentionally use target words that are assigned to other micro-scenes.
```

## 8. 主生成缺词/多词/多余英文检查重试约束

```text
Important fix (round {i}): ALL target words must be included.
Missing words: {missing}.
Overused words (too many repeats): {overused}. Reduce each to 1 occurrence, max 2.
Unexpected non-target English tokens found: {unexpectedEnglish}. Remove or translate them into Chinese. Only target words may remain in English.
Large Chinese gap(s) between adjacent target words: {betweenWordIssues}.
Lead Chinese-only gap before first target word is too long ({chars} chars).
Tail Chinese-only gap after last target word is too long ({chars} chars).
Keep one coherent mixed Chinese-English short passage. Do not split into unrelated fragments.
Preserve narrative order and story flow while fixing coverage issues.
Chinese connects the story; only target words stay in English.
Coverage is validated by exact literal English surface forms.
Chinese translation does NOT count as usage.
Never replace a target word with Chinese-only wording.
Every target word must appear in the final passage as the exact English token from input.
All other words must be Chinese. Do not include any non-target English token in the article body.
A short Chinese setup is allowed if it improves coherence.
Do not add dictionary explanations, word lists, or standalone example sentences.
The final article should feel like a complete scene rather than a vocabulary exercise.
```

## 9. 整篇重写修复约束

```text
Whole-passage repair attempt {repairAttempt}.
Rewrite the entire mixed passage from scratch as one coherent scene.
The previous attempt missed these exact target English tokens: {missingBeforeRewrite}.
Required exact target tokens: {words}.
Do not append a supplement paragraph. Do not add standalone example sentences.
Use every target word naturally inside the story.
All non-target content must be Chinese. Only target words may appear in English.
Final self-check before output: every required exact target token must be visibly present in the article body.
```

## 10. 释义按上下文精修：`refine_context`

```text
You are refining Chinese glosses for an IELTS mixed Chinese-English cloze article.
Return ONLY JSON array in same order as input words.
Each item format: {"word": string, "pos": string, "meaning": string}.
pos must be an English POS tag like n., v., adj., adv., prep., pron., conj., num., det., int.
meaning must match the article context exactly and be concise Chinese (2-8 chars).
meaning should be suitable for direct visual display under the word.
Keep meaning short, natural, and learner-friendly.
Avoid dictionary-style wording, abstract phrasing, or overly literal glosses.
Prioritize the most common IELTS exam sense in this context.
Avoid rare/archaic senses and avoid literal dictionary noise.
When context is lab cleanliness, sterility should be 无菌 (not 不育).
When context is emotional anger, bristle should be 发怒/恼火 (not 竖起).
Do not include English in meaning.
Words: {words}
Word context + candidate senses:
{guide}
```

## 11. 混合短文语义检查：`review_semantics`

```text
You are reviewing semantic naturalness for a Chinese-first mixed-language passage.
Return ONLY JSON array in the same order as input words.
Each item format:
{"word": string, "natural": boolean, "meaning_ok": boolean, "reason": string, "suggestion": string}
Rules:
1) natural=false when the sentence sounds forced, collocation is odd, or native-like Chinese mixed speech would not say it this way.
2) meaning_ok=false when the displayed Chinese meaning does not match the sentence context.
3) reason/suggestion should be concise Chinese, no markdown.
4) Be strict and practical; do not mark everything true.
5) Coverage is validated by exact literal English surface forms.
6) Chinese translation does NOT count as usage.
7) Do not suggest replacing the target word with a Chinese-only paraphrase.
8) The target word must remain visible in English.
9) If the target word is "Derive", "Sterility", "Plume", "Bristle", "Cricket", etc., do not suggest translating it away.
Words: {sourceWords}
Word guide:
{reviewGuide}
Passage:
{article}
```

## 12. 尴尬句子重写：`rewrite_awkward`

```text
You are revising awkward lines in a Chinese-first mixed-language passage.
Return ONLY the fully revised passage text, no JSON, no markdown.
Keep the same overall voice and paragraph rhythm.
Only rewrite clauses/sentences that are semantically awkward or collocation-wrong.
Do not add glossary sections, keyword lists, or dictionary-style lines.
Do not output Chinese gloss + English word duplicates (e.g., 残忍cruel / 无菌sterility with direct duplicate meaning).
Keep target words in their original form.
Coverage is validated by exact literal English surface forms.
Chinese translation does NOT count as usage.
Do not remove, translate away, or paraphrase away any target English word.
Keep every target word visible in exact English form.
If the target word is "Derive", "Sterility", "Plume", "Bristle", "Cricket", etc., do not translate it away.
If one word is hard to place naturally, move it to a short separate micro-scene.
Problem words and notes JSON:
{issues}
Vocabulary guide:
{issueGuide}
Original passage:
{source}
```

## 13. 普通英文文章段落翻译：`translate_paragraphs`

```text
Translate each English paragraph into Chinese.
Return ONLY JSON array of strings, same order and same length.
Keep markers like ①② in translation when they appear.
Use concise natural Chinese.
Vocabulary guide:
{vocabHints}
Paragraphs JSON:
{paragraphs}
```

## 14. 普通英文文章词义对齐：`alignment`

```text
You align IELTS target words to bilingual article terms.
Return ONLY JSON object with key "items".
items[] format:
{"word": string, "marker": "①-⑩", "english_forms": string[], "zh_terms": string[]}
Rules:
1) word must be one of target words.
2) english_forms: forms actually appearing in English article, include variants like literacy, drainage, mishaps when aligned.
3) zh_terms: Chinese terms that MUST appear literally in Chinese translation.
4) marker should match the closest sense marker in vocabulary guide.
5) No explanation text.
Target words: {words}
Vocabulary guide:
{vocabHints}
English paragraphs JSON:
{paragraphsEn}
Chinese paragraphs JSON:
{paragraphsZh}
```

## 15. 单词详情补全：`vocab_detail_enrich`

```text
You are filling detailed IELTS vocabulary card fields for one word.
Return ONLY JSON object.
{"word":"...", "collocations": string[], "word_formation": string, "synonyms": string[], "antonyms": string[]}
Rules:
1) Keep collocations practical and high-frequency, format like: phrase (中文).
2) word_formation should be concise Chinese root/prefix/suffix explanation when useful.
3) synonyms/antonyms should be common exam-friendly words.
4) Do not return empty placeholders like (暂无) unless truly impossible.
Word: {word}
Current card snapshot:
{entry}
```
