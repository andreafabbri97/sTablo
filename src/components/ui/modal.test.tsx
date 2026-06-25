// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Modal } from "./modal";

afterEach(cleanup);

describe("Modal", () => {
  it("renders nothing while closed", () => {
    render(
      <Modal open={false} onClose={() => {}} title="Titolo">
        <p>Contenuto</p>
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Contenuto")).toBeNull();
  });

  it("renders title and children when open", () => {
    render(
      <Modal open onClose={() => {}} title="Titolo">
        <p>Contenuto</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Titolo")).toBeInTheDocument();
    expect(screen.getByText("Contenuto")).toBeInTheDocument();
  });

  it("links the dialog to its title via aria-labelledby", () => {
    render(
      <Modal open onClose={() => {}} title="Titolo">
        <p>Contenuto</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(screen.getByText("Titolo")).toHaveAttribute("id", labelledBy);
  });

  it("moves focus into the dialog on open", () => {
    render(
      <Modal open onClose={() => {}} title="Titolo">
        <p>Contenuto</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toContainElement(
      document.activeElement as HTMLElement,
    );
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Titolo">
        <p>Contenuto</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the close control is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Titolo">
        <p>Contenuto</p>
      </Modal>,
    );
    // Both the backdrop and the X button expose the "Chiudi" label.
    const closers = screen.getAllByRole("button", { name: "Chiudi" });
    fireEvent.click(closers[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
