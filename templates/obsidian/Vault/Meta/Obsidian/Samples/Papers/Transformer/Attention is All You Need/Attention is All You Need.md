---
title: Attention Is All You Need
subtitle:
author:
  - Ashish Vaswani
  - Noam Shazeer
  - Niki Parmar
  - Jakob Uszkoreit
  - Llion Jones
  - Aidan N. Gomez
  - Łukasz Kaiser
  - Illia Polosukhin
affiliation:
  - Google Brain
  - Google Research
  - University of Toronto
investigation: architecture
talk: "[DeepHack.Babel. Illia Polosukhin. Attention is all you need by DeepPavlov](https://www.youtube.com/watch?v=I0nX4HDmXKc)"
venue: NeurIPS
venue-kind: conference
year: 2017
published: 2017-06-12
paper: "[[Attention Is All You Need.pdf]]"
figure: 3
arxiv: 1706.03762
arxiv-version: v7
doi: 10.48550/arXiv.1706.03762
citekey: vaswani2017attention
tier: S+++
status: reading
citations: 188791
code: https://github.com/tensorflow/tensor2tensor
blog: https://research.google/blog/transformer-a-novel-neural-network-architecture-for-language-understanding/
site:
reviews:
course: "[[Stanford CS224N]]"
claim: Sequence transduction needs no recurrence or convolution — stacked self-attention alone reaches better BLEU at a fraction of the training cost.
takeaway: Timeline is diverged.
datsets:
  - WMT 2014
prereq:
  - "[[Layer Normalization]]"
builds-on:
  - "[[Neural Machine Translation by Jointly Learning to Align and Translate]]"
  - "[[Structured Self-Attentive Sentence Embedding]]"
extends:
  - ""
compare-with:
  - "[[Convolutional Sequence to Sequence Learning]]"
refutes:
superseded-by:
related:
  - ""
pages: 15
progress: 13
coverage: 73
highlights: 116
underlines: 5
last-read: 2026-08-15
explore: 9
tags:
  - paper
  - transformer
  - attention
  - nlp
---

request a free api key from https://www.semanticscholar.org/product/api#api-key-form

investigation for nlp can be: architecture | empirical | theory | survey | position | dataset

```datacorejsx
const { Infobox } = await dc.require("Meta/Obsidian/_datacore/paper/infobox.jsx");
return function View() { return <Infobox path={dc.useCurrentPath()} />; };
```

if you need to check the diff between new updates, use https://github.com/shishir9159/fenrir