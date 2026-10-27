"use client";

import { useState } from "react";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import {
  DEFAULT_ORDER,
  fill,
  listChoices,
  matches,
  pageCount,
  pageRows,
  pageWithin,
  sortList,
  sortTable,
  tableChoices,
} from "@/lib/block-sort";
import {
  BLOCK_SEARCH,
  BLOCK_WORDS,
} from "@/lib/generated/platform-contracts/block-rules";
import { SPACING } from "@/lib/spacing";
import type { BlockPlace } from "./look";
import { Pager, SearchBox, SortChoice } from "./ListTools";
import { ListBlock, TableBlock, type BlockOf } from "./renderers";

type PagedBlock = BlockOf<"list"> | BlockOf<"table">;

/** The rows a search reads: a list row's title and subtitle, a table row's every cell. */
function fieldsOf(block: PagedBlock) {
  return block.type === "list"
    ? block.items.map((item) => [item.title, item.subtitle])
    : block.rows.map((row) => row.cells);
}

/**
 * A list or a table inside the blocks, with its search, sort and pages
 * (backend ADR-0048 amendment 1, decision 4): long — more than
 * `pageSize` (25) rows — it searches, sorts ("Default order", the order as
 * sent, first) and pages; a list the platform marks `searchable` (an item's
 * runs) searches whatever its length. A new search or sort goes back to page
 * 1, and a search that finds nothing says so in the list's place. The rows
 * are drawn by the hookless renderers, as sent; only which rows, and their
 * order, change.
 */
export function Paged({
  block,
  place,
}: {
  block: PagedBlock;
  place: BlockPlace;
}) {
  const [query, setQuery] = useState("");
  const [choice, setChoice] = useState(DEFAULT_ORDER);
  const [page, setPage] = useState(1);
  const size = BLOCK_SEARCH.pageSize;
  const fields = fieldsOf(block);
  const long = fields.length > size;
  const searches =
    fields.length > 0 &&
    (long || (block.type === "list" && block.searchable === true));
  const draw = (shown: PagedBlock) =>
    shown.type === "list" ? (
      <ListBlock block={shown} context={place} />
    ) : (
      <TableBlock block={shown} />
    );
  if (!searches) return draw(block);

  const found = fields
    .map((row, at) => ({ row, at }))
    .filter(({ row }) => matches(query, row))
    .map(({ at }) => at);
  const choices =
    block.type === "list"
      ? listChoices(
          found.map((at) => block.items[at]!),
          BLOCK_WORDS,
        )
      : tableChoices(
          block.columns,
          found.map((at) => block.rows[at]!.cells),
          BLOCK_WORDS,
        );
  // A choice the rows found no longer offer is the default again.
  const sortBy = choices.some((one) => one.value === choice)
    ? choice
    : DEFAULT_ORDER;
  const order = (
    block.type === "list"
      ? sortList(
          found.map((at) => block.items[at]!),
          sortBy,
        )
      : sortTable(
          found.map((at) => block.rows[at]!.cells),
          sortBy,
        )
  ).map((index) => found[index]!);
  const pages = pageCount(order.length, size);
  const shownPage = pageWithin(page, order.length, size);
  const rows = long ? pageRows(order, shownPage, size) : order;
  const picked: PagedBlock =
    block.type === "list"
      ? { ...block, items: rows.map((at) => block.items[at]!) }
      : { ...block, rows: rows.map((at) => block.rows[at]!) };

  return (
    <div
      data-testid="block-paged"
      className={`flex flex-col ${SPACING.inner.gap}`}
    >
      <SearchBox
        hint={BLOCK_WORDS.search}
        value={query}
        onChange={(next) => {
          setQuery(next);
          setPage(1);
        }}
      />
      {long ? (
        <SortChoice
          choices={choices}
          value={sortBy}
          onChange={(next) => {
            setChoice(next);
            setPage(1);
          }}
        />
      ) : null}
      {order.length === 0 ? (
        <EmptyRow
          band={false}
          text={fill(BLOCK_WORDS.noMatch, { query: query.trim() })}
        />
      ) : (
        draw(picked)
      )}
      {long ? <Pager page={shownPage} pages={pages} onPage={setPage} /> : null}
    </div>
  );
}
