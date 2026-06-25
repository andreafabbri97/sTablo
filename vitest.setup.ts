// Registers @testing-library's DOM matchers (toBeInTheDocument, toHaveFocus, …)
// on Vitest's `expect`. Importing only extends `expect`; it touches no DOM at
// load time, so it's harmless for the node-environment logic tests too.
import "@testing-library/jest-dom/vitest";
