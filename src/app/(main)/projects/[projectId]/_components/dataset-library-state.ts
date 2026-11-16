export type DatasetLibraryView = "cards" | "table";

export function toggleDatasetLibraryView(view: DatasetLibraryView): DatasetLibraryView {
  return view === "cards" ? "table" : "cards";
}

export function readDatasetLibraryView(): DatasetLibraryView {
  try {
    const value = window.localStorage.getItem("dataset-library-view");
    return value === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
}

export function saveDatasetLibraryView(view: DatasetLibraryView) {
  try {
    window.localStorage.setItem("dataset-library-view", view);
  } catch {
    // Storage can be unavailable in private or restricted browsing contexts.
  }
}
