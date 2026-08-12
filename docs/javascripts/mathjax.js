// MathJax v3 config for pymdownx.arithmatex (generic mode).
window.MathJax = {
  tex: {
    inlineMath: [["\\(", "\\)"]],
    displayMath: [["\\[", "\\]"]],
    processEscapes: true,
    processEnvironments: true,
  },
  options: {
    ignoreHtmlClass: ".*|",
    processHtmlClass: "arithmatex",
  },
};

// Re-typeset on MkDocs Material's instant navigation.
//
// Two things have to hold on *every* emission of document$, not just the first,
// or equations intermittently stay as raw \( \) source until a hard reload:
//
//   1. MathJax has to have finished booting. It is a separate <script>, so on a
//      cold load document$ can fire before MathJax.typesetPromise exists.
//      Chaining onto startup.promise is MathJax's documented way to wait.
//   2. The previous page's state has to be dropped. navigation.instant swaps
//      the <body> in place, so MathJax's math list and CHTML output cache still
//      reference detached nodes; typesetting on top of that rejects, and the
//      new page never renders.
//
// The trailing catch matters too: startup.promise is reused across navigations,
// so a rejection left unhandled would break every subsequent page as well.
document$.subscribe(() => {
  if (!window.MathJax || !MathJax.startup) return;
  MathJax.startup.promise = MathJax.startup.promise
    .then(() => {
      MathJax.startup.output.clearCache();
      MathJax.typesetClear();
      MathJax.texReset();
      return MathJax.typesetPromise();
    })
    .catch((err) => console.error("MathJax typesetting failed:", err));
});
