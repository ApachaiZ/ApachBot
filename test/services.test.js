"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {parseServices, pickService} = require("../lib/services");

test("parseServices: mono-serveur (fallback)", () => {
  assert.deepEqual(parseServices(undefined, "svc-abc"), {default: "svc-abc"});
  assert.deepEqual(parseServices("", "svc-abc"), {default: "svc-abc"});
});

test("parseServices: multi-serveur", () => {
  assert.deepEqual(parseServices("main=svc-abc,survival=svc-def", undefined), {
    main: "svc-abc",
    survival: "svc-def",
  });
});

test("parseServices: espaces tolérés", () => {
  assert.deepEqual(parseServices(" main = svc-abc , survival = svc-def ", undefined), {
    main: "svc-abc",
    survival: "svc-def",
  });
});

test("parseServices: entrées invalides ignorées", () => {
  assert.deepEqual(parseServices("broken", undefined), {});
  assert.deepEqual(parseServices("a=", undefined), {});
  assert.deepEqual(parseServices("=svc-x", undefined), {});
  assert.deepEqual(parseServices("a=YOUR_id", undefined), {});
});

test("parseServices: multi prioritaire sur fallback", () => {
  assert.deepEqual(parseServices("main=svc-abc", "should-be-ignored"), {main: "svc-abc"});
});

test("pickService: alias explicite", () => {
  const services = {main: "svc-abc", survival: "svc-def"};
  assert.deepEqual(pickService(services, "main", "survival"), {alias: "survival", id: "svc-def"});
});

test("pickService: alias absent → service par défaut", () => {
  const services = {main: "svc-abc", survival: "svc-def"};
  assert.deepEqual(pickService(services, "main", undefined), {alias: "main", id: "svc-abc"});
  assert.deepEqual(pickService(services, "main", ""), {alias: "main", id: "svc-abc"});
});

test("pickService: alias inconnu → throw", () => {
  const services = {main: "svc-abc"};
  assert.throws(() => pickService(services, "main", "unknown"), /Unknown service/);
});
