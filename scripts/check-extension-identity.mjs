#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const CANONICAL_ID = "containtab@woolkingx.local";
const OLD_IDS = new Set([
  "containtab-dev@example.invalid",
  "containerise@kinte.sh"
]);

const ROOT = process.cwd();
const FIREBOX_ROOT = path.resolve(ROOT, "../..", "firebox");
const PACKAGE_VERSION = readJson(path.join(ROOT, "package.json")).version;

const checks = [];
const failures = [];

function existing(filePath) {
  return fs.existsSync(filePath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function manifestId(manifest) {
  return manifest.browser_specific_settings?.gecko?.id
    || manifest.applications?.gecko?.id
    || "";
}

function manifestKey(manifest) {
  if (manifest.browser_specific_settings?.gecko?.id) return "browser_specific_settings.gecko.id";
  if (manifest.applications?.gecko?.id) return "applications.gecko.id";
  return "missing";
}

function record(ok, label, detail) {
  checks.push({ ok, label, detail });
  if (!ok) failures.push(`${label}: ${detail}`);
}

function assertManifest(filePath, label) {
  if (!existing(filePath)) {
    record(false, label, `missing ${filePath}`);
    return;
  }
  const manifest = readJson(filePath);
  const id = manifestId(manifest);
  record(id === CANONICAL_ID, label, `${manifestKey(manifest)}=${id || "(missing)"}`);
}

function readZipManifest(zipPath) {
  const text = execFileSync("unzip", ["-p", zipPath, "manifest.json"], { encoding: "utf8" });
  return JSON.parse(text);
}

function assertZipManifest(zipPath, label) {
  if (!existing(zipPath)) {
    record(false, label, `missing ${zipPath}`);
    return;
  }
  const manifest = readZipManifest(zipPath);
  const id = manifestId(manifest);
  record(id === CANONICAL_ID, label, `${manifestKey(manifest)}=${id || "(missing)"}`);
}

function assertPolicy(policyPath, label) {
  if (!existing(policyPath)) {
    record(false, label, `missing ${policyPath}`);
    return;
  }
  const policy = readJson(policyPath);
  const settings = policy.policies?.ExtensionSettings || {};
  record(Object.prototype.hasOwnProperty.call(settings, CANONICAL_ID), label, `contains ${CANONICAL_ID}`);
  for (const oldId of OLD_IDS) {
    record(!Object.prototype.hasOwnProperty.call(settings, oldId), `${label} old id`, `does not contain ${oldId}`);
  }
}

function assertExtensionDir(dirPath, label) {
  if (!existing(dirPath)) {
    record(false, label, `missing ${dirPath}`);
    return;
  }
  const files = fs.readdirSync(dirPath);
  record(files.includes(`${CANONICAL_ID}.xpi`), label, `contains ${CANONICAL_ID}.xpi`);
  for (const oldId of OLD_IDS) {
    record(!files.includes(`${oldId}.xpi`), `${label} old xpi`, `does not contain ${oldId}.xpi`);
  }
  assertZipManifest(path.join(dirPath, `${CANONICAL_ID}.xpi`), `${label} bundled manifest`);
}

assertManifest(path.join(ROOT, "src/manifest.json"), "source manifest");
assertManifest(path.join(ROOT, "build/manifest.json"), "build manifest");
assertZipManifest(path.join(ROOT, "web-ext-artifacts", `containtab-${PACKAGE_VERSION}.zip`), "release zip manifest");

for (const tree of ["firefox-patch", "firefox-public"]) {
  const base = path.join(FIREBOX_ROOT, tree, "200-ui", "distribution");
  assertPolicy(path.join(base, "policies.json"), `${tree} policy`);
  assertExtensionDir(path.join(base, "extensions"), `${tree} extensions`);
}

for (const check of checks) {
  const status = check.ok ? "PASS" : "FAIL";
  console.log(`${status} ${check.label}: ${check.detail}`);
}

if (failures.length > 0) {
  console.error(`\nExtension identity gate failed for canonical ID ${CANONICAL_ID}`);
  process.exit(1);
}

console.log(`\nExtension identity gate passed for ${CANONICAL_ID}`);
