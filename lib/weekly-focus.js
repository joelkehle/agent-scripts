"use strict";

const fs = require("node:fs");

const DEFAULT_FOCUS_FILE =
  process.env.AGENT_FOCUS_FILE ||
  "/mnt/synology-share1/AgentCoord/registry/weekly-focus.yaml";
const EXCEPTION_CATEGORIES = new Set([
  "production_incident",
  "security_exposure",
  "data_loss_risk",
  "immovable_external_deadline",
]);
const FOCUS_SCHEMA_V2 = "weekly-focus.v2";
const LEGACY_EXECUTION_REFS_FIELD = "execution_refs";
const V2_EXECUTION_REFS_FIELDS = ["active_execution_refs", "proof_execution_refs"];
const EXECUTION_REFS_FIELDS = new Set([
  LEGACY_EXECUTION_REFS_FIELD,
  ...V2_EXECUTION_REFS_FIELDS,
]);
const GOAL_FIELDS = new Set([
  "id",
  "done",
  "required_milestone",
  "fallback",
  ...EXECUTION_REFS_FIELDS,
]);
const REQUIRED_GOAL_FIELDS = new Set(["id", "done", "required_milestone", "fallback"]);
const EXECUTION_KINDS = new Set(["mission", "initiative", "campaign"]);
const EXECUTION_REF_FIELDS = new Set(["kind", "id"]);
const TOP_LEVEL_FIELDS = new Set(["schema", "week_ending", "goals", "not_this_week"]);
const REQUIRED_TOP_LEVEL_FIELDS = new Set(["week_ending", "goals", "not_this_week"]);
const FOCUS_TIME_ZONE = "America/Los_Angeles";

class FocusValidationError extends Error {
  constructor(errors, file = "") {
    super(`invalid weekly focus${file ? ` ${file}` : ""}: ${errors.join("; ")}`);
    this.name = "FocusValidationError";
    this.errors = errors;
    this.file = file;
  }
}

function scalar(value, location, errors) {
  const text = value.trim();
  if (!text) return "";
  if (text.startsWith('"')) {
    try {
      return JSON.parse(text);
    } catch (error) {
      errors.push(`${location}: invalid quoted string (${error.message})`);
      return "";
    }
  }
  if (text.startsWith("'")) {
    if (!text.endsWith("'") || text.length < 2) {
      errors.push(`${location}: unterminated quoted string`);
      return "";
    }
    return text.slice(1, -1).replaceAll("''", "'");
  }
  if (text === "true") return true;
  if (text === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  if (/[\[\]{}&*!]|^[-?:]\s/.test(text)) {
    errors.push(`${location}: unsupported YAML syntax`);
    return "";
  }
  return text.replace(/\s+#.*$/, "").trim();
}

function blockScalar(lines, start, minimumIndent, style, location, errors) {
  const content = [];
  let index = start;
  while (index < lines.length) {
    const raw = lines[index];
    if (!raw.trim()) {
      content.push("");
      index += 1;
      continue;
    }
    const indent = raw.match(/^ */)[0].length;
    if (indent < minimumIndent) break;
    content.push(raw.slice(minimumIndent).trimEnd());
    index += 1;
  }
  if (!content.some((line) => line.trim())) {
    errors.push(`${location}: block scalar must not be empty`);
    return { value: "", next: index };
  }
  if (style === "|") return { value: content.join("\n").trim(), next: index };

  const paragraphs = [];
  let current = [];
  for (const line of content) {
    if (!line.trim()) {
      if (current.length) paragraphs.push(current.join(" "));
      current = [];
    } else {
      current.push(line.trim());
    }
  }
  if (current.length) paragraphs.push(current.join(" "));
  return { value: paragraphs.join("\n"), next: index };
}

function assign(object, key, value, location, allowed, errors) {
  if (!allowed.has(key)) {
    errors.push(`${location}: unknown field ${key}`);
    return;
  }
  if (Object.hasOwn(object, key)) {
    errors.push(`${location}: duplicate field ${key}`);
    return;
  }
  object[key] = value;
}

function parseFocusYaml(text) {
  const errors = [];
  const focus = {};
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  let section = "";
  let goal = null;
  let executionRef = null;
  let executionRefsField = "";

  for (let index = 0; index < lines.length; ) {
    const raw = lines[index];
    const lineNumber = index + 1;
    if (raw.includes("\t")) errors.push(`line ${lineNumber}: tabs are not allowed`);
    if (!raw.trim() || raw.trimStart().startsWith("#")) {
      index += 1;
      continue;
    }
    const indent = raw.match(/^ */)[0].length;
    const content = raw.trim();

    if (indent === 0) {
      const match = content.match(/^([a-z_]+):(.*)$/);
      if (!match) {
        errors.push(`line ${lineNumber}: expected a top-level field`);
        index += 1;
        continue;
      }
      const [, key, remainder] = match;
      if (!TOP_LEVEL_FIELDS.has(key)) {
        errors.push(`line ${lineNumber}: unknown field ${key}`);
        index += 1;
        continue;
      }
      if (Object.hasOwn(focus, key)) {
        errors.push(`line ${lineNumber}: duplicate field ${key}`);
        index += 1;
        continue;
      }
      goal = null;
      executionRef = null;
      executionRefsField = "";
      if (key === "goals" || key === "not_this_week") {
        if (remainder.trim()) errors.push(`line ${lineNumber}: ${key} must be a block list`);
        focus[key] = [];
        section = key;
      } else {
        focus[key] = scalar(remainder, `line ${lineNumber}`, errors);
        section = "";
      }
      index += 1;
      continue;
    }

    if (section === "goals") {
      const newGoal = content.match(/^-\s+([a-z_]+):(.*)$/);
      const field = content.match(/^([a-z_]+):(.*)$/);
      let match = null;
      if (indent === 2 && newGoal) {
        goal = {};
        focus.goals.push(goal);
        executionRef = null;
        executionRefsField = "";
        match = newGoal;
      } else if (indent === 4 && field && goal) {
        match = field;
      } else if (
        indent === 6 &&
        newGoal &&
        executionRefsField &&
        Array.isArray(goal?.[executionRefsField])
      ) {
        executionRef = {};
        goal[executionRefsField].push(executionRef);
        const [, key, remainder] = newGoal;
        assign(
          executionRef,
          key,
          scalar(remainder, `line ${lineNumber}`, errors),
          `line ${lineNumber}`,
          EXECUTION_REF_FIELDS,
          errors,
        );
        index += 1;
        continue;
      } else if (indent === 8 && field && executionRef) {
        const [, key, remainder] = field;
        assign(
          executionRef,
          key,
          scalar(remainder, `line ${lineNumber}`, errors),
          `line ${lineNumber}`,
          EXECUTION_REF_FIELDS,
          errors,
        );
        index += 1;
        continue;
      } else {
        errors.push(`line ${lineNumber}: malformed goal entry`);
        index += 1;
        continue;
      }
      const [, key, remainder] = match;
      const rawValue = remainder.trim();
      if (EXECUTION_REFS_FIELDS.has(key)) {
        if (rawValue && rawValue !== "[]") {
          errors.push(`line ${lineNumber}: ${key} must be a block list or []`);
        }
        assign(goal, key, [], `line ${lineNumber}`, GOAL_FIELDS, errors);
        executionRef = null;
        executionRefsField = key;
        index += 1;
      } else if (rawValue === ">" || rawValue === "|") {
        executionRef = null;
        executionRefsField = "";
        const block = blockScalar(lines, index + 1, indent + 2, rawValue, `line ${lineNumber}`, errors);
        assign(goal, key, block.value, `line ${lineNumber}`, GOAL_FIELDS, errors);
        index = block.next;
      } else {
        executionRef = null;
        executionRefsField = "";
        assign(goal, key, scalar(remainder, `line ${lineNumber}`, errors), `line ${lineNumber}`, GOAL_FIELDS, errors);
        index += 1;
      }
      continue;
    }

    if (section === "not_this_week" && indent === 2 && content.startsWith("- ")) {
      focus.not_this_week.push(scalar(content.slice(2), `line ${lineNumber}`, errors));
      index += 1;
      continue;
    }

    errors.push(`line ${lineNumber}: unexpected indentation or content`);
    index += 1;
  }
  return { focus, errors };
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function calendarDate(now = new Date(), timeZone = FOCUS_TIME_ZONE) {
  const date = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(date.getTime())) throw new TypeError("clock must provide a valid date");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function focusStatus(focus, now = new Date()) {
  const current_date = calendarDate(now);
  const expired = validDate(focus?.week_ending) && current_date > focus.week_ending;
  return {
    status: expired ? "expired" : "current",
    expired,
    current_date,
    time_zone: FOCUS_TIME_ZONE,
  };
}

function validateFocus(focus, parseErrors = []) {
  const errors = [...parseErrors];
  for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
    if (!Object.hasOwn(focus, field)) errors.push(`missing ${field}`);
  }
  const isV2 = Object.hasOwn(focus, "schema");
  if (isV2 && focus.schema !== FOCUS_SCHEMA_V2) {
    errors.push(`schema must be ${FOCUS_SCHEMA_V2}`);
  }
  if (Object.hasOwn(focus, "week_ending") && !validDate(focus.week_ending)) {
    errors.push("week_ending must be a valid YYYY-MM-DD date");
  }
  if (!Array.isArray(focus.goals) || focus.goals.length === 0) {
    errors.push("goals must be a non-empty list");
  } else {
    const ids = new Set();
    focus.goals.forEach((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`goals[${index}] must be an object`);
        return;
      }
      for (const field of REQUIRED_GOAL_FIELDS) {
        if (typeof item[field] !== "string" || !item[field].trim()) {
          errors.push(`goals[${index}].${field} must be a non-empty string`);
        }
      }
      if (typeof item.id === "string" && item.id.trim()) {
        if (item.id !== item.id.trim()) {
          errors.push(`goals[${index}].id must not contain leading or trailing whitespace`);
        }
        if (ids.has(item.id)) errors.push(`duplicate goal id ${item.id}`);
        ids.add(item.id);
      }
      const hasLegacyRefs = Object.hasOwn(item, LEGACY_EXECUTION_REFS_FIELD);
      const v2RefFields = V2_EXECUTION_REFS_FIELDS.filter((field) => Object.hasOwn(item, field));
      if (isV2 && hasLegacyRefs) {
        errors.push(`goals[${index}] mixes ${FOCUS_SCHEMA_V2} with legacy execution_refs`);
      }
      if (!isV2 && v2RefFields.length) {
        errors.push(`goals[${index}] uses version 2 reference fields without schema ${FOCUS_SCHEMA_V2}`);
      }
      if (hasLegacyRefs && v2RefFields.length) {
        errors.push(`goals[${index}] must not mix execution_refs with version 2 reference fields`);
      }

      const seenRefs = new Map();
      for (const field of EXECUTION_REFS_FIELDS) {
        if (!Object.hasOwn(item, field)) continue;
        if (!Array.isArray(item[field])) {
          errors.push(`goals[${index}].${field} must be a list`);
          continue;
        }
        item[field].forEach((ref, refIndex) => {
          const location = `goals[${index}].${field}[${refIndex}]`;
          const refErrors = validateExecutionRef(ref, location);
          errors.push(...refErrors);
          if (refErrors.length) return;
          const key = `${ref.kind}\0${ref.id}`;
          if (seenRefs.has(key)) {
            errors.push(`${location} duplicates ${seenRefs.get(key)}`);
          } else {
            seenRefs.set(key, location);
          }
        });
      }
    });
  }
  if (!Array.isArray(focus.not_this_week)) {
    errors.push("not_this_week must be a list");
  } else if (focus.not_this_week.some((item) => typeof item !== "string" || !item.trim())) {
    errors.push("not_this_week entries must be non-empty strings");
  }
  return { ok: errors.length === 0, errors, focus };
}

function validateExecutionRef(ref, location = "execution_ref") {
  const errors = [];
  if (!ref || typeof ref !== "object" || Array.isArray(ref)) {
    return [`${location} must be an object`];
  }
  for (const field of Object.keys(ref)) {
    if (!EXECUTION_REF_FIELDS.has(field)) errors.push(`${location}: unknown field ${field}`);
  }
  if (!EXECUTION_KINDS.has(ref.kind)) {
    errors.push(`${location}.kind must be mission, initiative, or campaign`);
  }
  if (
    typeof ref.id !== "string" ||
    !/^[^\s\x00-\x1F\x7F-\x9F]{1,256}$/u.test(ref.id)
  ) {
    errors.push(`${location}.id must be a non-empty opaque execution ID`);
  }
  return errors;
}

function loadFocus(file = DEFAULT_FOCUS_FILE, options = {}) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    throw new FocusValidationError([`cannot read file: ${error.message}`], file);
  }
  const parsed = parseFocusYaml(text);
  const result = validateFocus(parsed.focus, parsed.errors);
  if (!result.ok) throw new FocusValidationError(result.errors, file);
  const temporal = focusStatus(result.focus, options.now);
  if (temporal.expired && !options.allowExpired) {
    throw new FocusValidationError([
      `week_ending ${result.focus.week_ending} expired after that calendar date in ${FOCUS_TIME_ZONE}; current date is ${temporal.current_date}`,
    ], file);
  }
  return { ...result.focus, ...temporal, file };
}

function resolveGoal(focus, goalId, options = {}) {
  const temporal = focusStatus(focus, options.now);
  if (temporal.expired) {
    throw new FocusValidationError([
      `week_ending ${focus.week_ending} expired after that calendar date in ${FOCUS_TIME_ZONE}; current date is ${temporal.current_date}`,
    ], focus.file);
  }
  const id = String(goalId || "").trim();
  const goal = focus.goals.find((item) => item.id === id);
  if (!goal) throw new FocusValidationError([`unknown goal id ${id || "(missing)"}`], focus.file);
  return {
    kind: "goal",
    ...(focus.schema ? { schema: focus.schema } : {}),
    week_ending: focus.week_ending,
    goal_id: goal.id,
    ...goal,
  };
}

function resolveException(focus, category, reason, options = {}) {
  const normalizedCategory = String(category || "").trim();
  const normalizedReason = String(reason || "").trim();
  const errors = [];
  if (!EXCEPTION_CATEGORIES.has(normalizedCategory)) {
    errors.push(`invalid exception category ${normalizedCategory || "(missing)"}`);
  }
  if (!normalizedReason) errors.push("exception reason is required");
  if (errors.length) throw new FocusValidationError(errors, focus.file);
  return {
    kind: "exception",
    week_ending: focus.week_ending,
    focus_status: focus.status || focusStatus(focus, options.now).status,
    exception: { category: normalizedCategory, reason: normalizedReason },
  };
}

module.exports = {
  DEFAULT_FOCUS_FILE,
  EXECUTION_KINDS,
  EXCEPTION_CATEGORIES,
  FOCUS_SCHEMA_V2,
  FOCUS_TIME_ZONE,
  FocusValidationError,
  calendarDate,
  focusStatus,
  loadFocus,
  parseFocusYaml,
  resolveException,
  resolveGoal,
  validateExecutionRef,
  validateFocus,
};
