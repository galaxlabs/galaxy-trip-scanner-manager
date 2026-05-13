const DEFAULT_ROUTE_PAIRS = [
  ["makkah", "madinah"],
  ["madinah", "makkah"],
];

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .trim();
}

function routeText(route) {
  return normalize(
    routeParts(route).join(" ")
  );
}

function routeParts(route) {
  return [
    route?.name,
    route?.from_place_full,
    route?.to_place_full,
  ].filter(Boolean).map(normalize);
}

export function isDefaultRoute(route) {
  const from = normalize(route?.from_place_full || route?.name);
  const to = normalize(route?.to_place_full || route?.name);
  const name = normalize(route?.name);

  return DEFAULT_ROUTE_PAIRS.some(([defaultFrom, defaultTo]) => (
    (from.includes(defaultFrom) && to.includes(defaultTo)) ||
    name.includes(`${defaultFrom} to ${defaultTo}`) ||
    name.includes(`${defaultFrom} ${defaultTo}`)
  ));
}

function queryCharsInOrder(text, query) {
  let searchFrom = 0;
  for (const char of query) {
    const foundAt = text.indexOf(char, searchFrom);
    if (foundAt === -1) return false;
    searchFrom = foundAt + 1;
  }
  return true;
}

function queryCharsAnywhere(text, query) {
  return [...query].every((char) => text.includes(char));
}

function routeRank(route, query) {
  const text = routeText(route);
  if (!query) return 100;
  if (text.startsWith(query)) return 0;
  if (text.split(" ").some((word) => word.startsWith(query))) return 1;
  if (text.includes(query)) return 2;
  if (routeParts(route).some((part) => queryCharsInOrder(part, query))) return 3;
  if (queryCharsAnywhere(text, query)) return 4;
  return 99;
}

export function getVisibleRoutes(routes, searchTerm, limit = 60) {
  const query = normalize(searchTerm);
  const defaults = [];
  const rest = [];

  for (const route of routes || []) {
    if (isDefaultRoute(route)) defaults.push(route);
    else rest.push(route);
  }

  const directMatches = rest
    .filter((route) => !query || routeText(route).includes(query))
    .sort((a, b) => routeRank(a, query) - routeRank(b, query) || routeText(a).localeCompare(routeText(b)));

  const looseMatches = query && directMatches.length === 0
    ? rest
        .filter((route) => queryCharsAnywhere(routeText(route), query))
        .sort((a, b) => routeRank(a, query) - routeRank(b, query) || routeText(a).localeCompare(routeText(b)))
    : [];

  const remaining = query
    ? []
    : rest.sort((a, b) => routeText(a).localeCompare(routeText(b)));

  return [
    ...defaults.sort((a, b) => {
      const aFrom = normalize(a?.from_place_full || a?.name);
      const aTo = normalize(a?.to_place_full || a?.name);
      const bFrom = normalize(b?.from_place_full || b?.name);
      const bTo = normalize(b?.to_place_full || b?.name);
      const aIndex = DEFAULT_ROUTE_PAIRS.findIndex(([from, to]) => aFrom.includes(from) && aTo.includes(to));
      const bIndex = DEFAULT_ROUTE_PAIRS.findIndex(([from, to]) => bFrom.includes(from) && bTo.includes(to));
      return aIndex - bIndex || routeText(a).localeCompare(routeText(b));
    }),
    ...directMatches,
    ...looseMatches,
    ...remaining,
  ].slice(0, limit);
}
