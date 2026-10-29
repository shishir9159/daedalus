---
title:
subtitle:
author:
edition:
series:
status:
tier:
pages:
progress:
underlines:
completed:
published:
released:
cover:
isbn:
asin:
site:
open access:
code:
course:
category:
publisher:
rolling-release:
blurb:
solutions:
errata:
tags:
  - book
---
```datacorejsx
const { BookPopulate } = await dc.require("Meta/Obsidian/_datacore/book/populate.jsx");
return function View() { return <BookPopulate path={dc.useCurrentPath()} />; };
```
