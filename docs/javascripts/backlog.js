/* Renders the Markdown table inside <div class="backlog"> as a board.
 *
 * The table is the single source of truth: contributors edit one row, and the
 * columns, filters and counts below are derived from it at page load. If this
 * script never runs, the plain table stays visible, so the page degrades to
 * exactly what the Markdown says.
 */
(function () {
  "use strict";

  // Board column order. A status outside this list still renders — it gets its
  // own column appended at the end, so a new state costs no code change.
  var STATUS_ORDER = ["Idea", "Planned", "In progress", "Done"];

  // Spellings contributors are likely to reach for, mapped onto the canonical set.
  var STATUS_ALIAS = {
    "backlog": "Idea",
    "proposed": "Idea",
    "todo": "Planned",
    "to do": "Planned",
    "next": "Planned",
    "wip": "In progress",
    "in-progress": "In progress",
    "doing": "In progress",
    "shipped": "Done",
    "complete": "Done",
    "completed": "Done"
  };

  var UNCLAIMED = ["", "-", "--", "—", "–", "none", "nobody", "tbd", "unclaimed", "n/a"];

  function normalise(text) {
    return text.toLowerCase().replace(/\s+/g, " ").trim();
  }

  function canonicalStatus(text) {
    var key = normalise(text);
    for (var i = 0; i < STATUS_ORDER.length; i++) {
      if (normalise(STATUS_ORDER[i]) === key) return STATUS_ORDER[i];
    }
    if (STATUS_ALIAS[key]) return STATUS_ALIAS[key];
    return text.trim() || "Unsorted";
  }

  function slug(text) {
    return normalise(text).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  // Stable hue per area, so a newly invented area gets a colour without anyone
  // editing the stylesheet.
  function hue(text) {
    var h = 0;
    var key = normalise(text);
    for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
    return h;
  }

  function isUnclaimed(text) {
    return UNCLAIMED.indexOf(normalise(text)) !== -1;
  }

  function element(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  /* Read the table into plain row objects, keyed by header name. */
  function readTable(table) {
    var headers = [].map.call(table.querySelectorAll("thead th"), function (th) {
      return normalise(th.textContent);
    });
    return [].map.call(table.querySelectorAll("tbody tr"), function (tr) {
      var row = {};
      [].forEach.call(tr.cells, function (cell, i) {
        var name = headers[i];
        if (!name) return;
        row[name] = { html: cell.innerHTML.trim(), text: cell.textContent.trim() };
      });
      return row;
    });
  }

  function field(row, name) {
    return row[name] || { html: "", text: "" };
  }

  function buildCard(row) {
    var area = field(row, "area").text;
    var champion = field(row, "champion").text;
    var effort = field(row, "effort").text;
    var notes = field(row, "notes").html;

    var card = element("article", "backlog__card");
    card.dataset.area = slug(area) || "unset";
    card.appendChild(element("p", "backlog__item", field(row, "item").html));
    if (notes && !isUnclaimed(notes)) {
      card.appendChild(element("p", "backlog__notes", notes));
    }

    var meta = element("div", "backlog__meta");
    if (area) {
      var tag = element("span", "backlog__tag", area);
      tag.style.setProperty("--tag-h", hue(area));
      meta.appendChild(tag);
    }
    if (effort && !isUnclaimed(effort)) {
      meta.appendChild(element("span", "backlog__effort", effort));
    }
    meta.appendChild(
      isUnclaimed(champion)
        ? element("span", "backlog__who backlog__who--free", "unclaimed")
        : element("span", "backlog__who", field(row, "champion").html)
    );
    card.appendChild(meta);
    return card;
  }

  function buildBoard(rows) {
    var statuses = STATUS_ORDER.slice();
    rows.forEach(function (row) {
      var status = canonicalStatus(field(row, "status").text);
      if (statuses.indexOf(status) === -1) statuses.push(status);
    });

    var board = element("div", "backlog__board");
    statuses.forEach(function (status) {
      var column = element("section", "backlog__column");
      column.dataset.status = slug(status);

      var head = element("h3", "backlog__column-head");
      head.appendChild(element("span", "backlog__column-name", status));
      head.appendChild(element("span", "backlog__count", "0"));
      column.appendChild(head);

      var cards = element("div", "backlog__cards");
      rows
        .filter(function (row) {
          return canonicalStatus(field(row, "status").text) === status;
        })
        .forEach(function (row) {
          cards.appendChild(buildCard(row));
        });
      cards.appendChild(element("p", "backlog__empty", "Nothing here."));
      column.appendChild(cards);
      board.appendChild(column);
    });
    return board;
  }

  function buildToolbar(rows, areas) {
    var toolbar = element("div", "backlog__toolbar");

    var filters = element("div", "backlog__filters");
    var all = element("button", "backlog__chip backlog__chip--all", "All areas");
    all.type = "button";
    all.dataset.area = "";
    all.setAttribute("aria-pressed", "true");
    filters.appendChild(all);
    areas.forEach(function (area) {
      var chip = element("button", "backlog__chip", area);
      chip.type = "button";
      chip.dataset.area = slug(area);
      chip.style.setProperty("--tag-h", hue(area));
      chip.setAttribute("aria-pressed", "false");
      filters.appendChild(chip);
    });
    toolbar.appendChild(filters);

    var unclaimed = rows.filter(function (row) {
      return isUnclaimed(field(row, "champion").text) &&
        canonicalStatus(field(row, "status").text) !== "Done";
    }).length;

    var summary = element(
      "div",
      "backlog__summary",
      rows.length + " items · " + unclaimed + " open and unclaimed"
    );
    var toggle = element("button", "backlog__view", "Table view");
    toggle.type = "button";
    summary.appendChild(toggle);
    toolbar.appendChild(summary);

    return { node: toolbar, chips: filters, toggle: toggle };
  }

  function applyFilter(board, active) {
    [].forEach.call(board.querySelectorAll(".backlog__column"), function (column) {
      var shown = 0;
      [].forEach.call(column.querySelectorAll(".backlog__card"), function (card) {
        var visible = !active.length || active.indexOf(card.dataset.area) !== -1;
        card.hidden = !visible;
        if (visible) shown++;
      });
      column.querySelector(".backlog__count").textContent = shown;
      column.classList.toggle("backlog__column--empty", shown === 0);
    });
  }

  function render(root) {
    if (root.dataset.rendered === "true") return;
    var table = root.querySelector("table");
    if (!table) return;

    var rows = readTable(table).filter(function (row) {
      return field(row, "item").text !== "";
    });
    if (!rows.length) return;

    var areas = [];
    rows.forEach(function (row) {
      var area = field(row, "area").text;
      if (area && areas.indexOf(area) === -1) areas.push(area);
    });
    areas.sort();

    var board = buildBoard(rows);
    var toolbar = buildToolbar(rows, areas);

    // Material wraps tables in its own scroll containers, so the element to
    // hide is the outermost wrapper that is still a child of the root.
    var tableWrap = table;
    while (tableWrap.parentNode && tableWrap.parentNode !== root) {
      tableWrap = tableWrap.parentNode;
    }
    tableWrap.classList.add("backlog__table");
    tableWrap.hidden = true;

    root.insertBefore(board, tableWrap);
    root.insertBefore(toolbar.node, board);

    var active = [];
    toolbar.chips.addEventListener("click", function (event) {
      var chip = event.target.closest(".backlog__chip");
      if (!chip) return;
      if (!chip.dataset.area) {
        active = [];
      } else {
        var i = active.indexOf(chip.dataset.area);
        if (i === -1) active.push(chip.dataset.area);
        else active.splice(i, 1);
      }
      [].forEach.call(toolbar.chips.children, function (other) {
        var on = other.dataset.area
          ? active.indexOf(other.dataset.area) !== -1
          : active.length === 0;
        other.setAttribute("aria-pressed", on ? "true" : "false");
      });
      applyFilter(board, active);
    });

    toolbar.toggle.addEventListener("click", function () {
      var showTable = board.hidden === false;
      board.hidden = showTable;
      tableWrap.hidden = !showTable;
      toolbar.chips.hidden = showTable;
      toolbar.toggle.textContent = showTable ? "Board view" : "Table view";
    });

    applyFilter(board, active);
    root.dataset.rendered = "true";
  }

  function init() {
    [].forEach.call(document.querySelectorAll(".backlog"), render);
  }

  // Material's instant navigation swaps the DOM without a reload; document$
  // fires on every page it settles on.
  if (typeof document$ !== "undefined" && document$.subscribe) {
    document$.subscribe(init);
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
