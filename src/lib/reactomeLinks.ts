/** Open Reactome keyword search; pathway names are not stable IDs—this is a practical UX integration link. */
export function reactomeSearchUrl(pathwayName: string): string {
  const q = encodeURIComponent(pathwayName.trim());
  return `https://reactome.org/ContentBrowser/#/SEARCH?q=${q}`;
}

export function stringProteinSearchUrl(geneOrProtein: string): string {
  return `https://string-db.org/cgi/network.pl?identifier=${encodeURIComponent(geneOrProtein)}`;
}
