import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readLoginFormCredentials } from "./form-credentials.ts";

function makeForm(fields: {
  email?: string;
  password?: string;
  name?: string;
  /** Simulate React state lagging behind DOM autofill */
  stateEmail?: string;
  statePassword?: string;
}) {
  // Minimal FormData-capable form using happy-dom-less stubs via undici FormData
  // Node 22 has FormData; build a fake HTMLFormElement-like object.
  const values: Record<string, string> = {};
  if (fields.email !== undefined) values.email = fields.email;
  if (fields.password !== undefined) values.password = fields.password;
  if (fields.name !== undefined) values.name = fields.name;

  const inputs = Object.entries(values).map(([name, value]) => {
    const el = {
      name,
      value,
      type: name === "password" ? "password" : name === "email" ? "email" : "text",
    };
    return el;
  });

  const form = {
    elements: {
      namedItem(name: string) {
        return inputs.find((i) => i.name === name) ?? null;
      },
    },
    querySelector() {
      return null;
    },
  } as unknown as HTMLFormElement;

  // Patch FormData constructor path: readLoginFormCredentials uses `new FormData(form)`.
  // In Node, FormData(form) needs a real form — so monkey by testing via input.value path.
  // We override FormData for this test module by ensuring namedItem values are used first.
  const original = globalThis.FormData;
  // @ts-expect-error test stub
  globalThis.FormData = class {
    constructor() {}
    get() {
      return null;
    }
  };

  try {
    return readLoginFormCredentials(form, {
      email: fields.stateEmail,
      password: fields.statePassword,
    });
  } finally {
    globalThis.FormData = original;
  }
}

describe("readLoginFormCredentials", () => {
  it("prefers DOM autofill over empty React state", () => {
    const creds = makeForm({
      email: " Buyer@Example.COM ",
      password: " CorrectHorseBattery ",
      stateEmail: "",
      statePassword: "",
    });
    assert.equal(creds.email, "buyer@example.com");
    assert.equal(creds.password, "CorrectHorseBattery");
  });

  it("trims password edges without eating internal spaces", () => {
    const creds = makeForm({
      email: "a@b.co",
      password: "  pass word  ",
    });
    assert.equal(creds.password, "pass word");
  });
});
