# HTTP Parameter Documentation Design

## Summary

Extend the generated API docs so regular request parameters are documented with the same level of usefulness as JSON body fields. The docs site should render request metadata for query parameters, path parameters, headers, form-urlencoded fields, and multipart fields using each field's existing schema properties rather than introducing a new annotation format.

## Goals

- Render documentation for `query` and `path` request params.
- Render documentation for request headers.
- Render documentation for `form-urlencoded` and `multipart-form` body fields.
- Reuse existing `description` and `type` metadata already present on request structures.
- Preserve current disabled-field behavior and existing JSON body annotation rendering.

## Non-Goals

- Do not introduce a new annotation schema for non-JSON parameters.
- Do not change the request runner or request execution behavior.
- Do not change example rendering unless needed for existing docs components.

## Current State

- JSON raw bodies support `annotations`, which are rendered into a body schema section in the docs UI.
- Query params render in a simple table with `Name` and `Value`.
- Headers render in a simple table with `Name` and `Value`.
- Form and multipart bodies render as a code-like blob rather than documented fields.
- Request types already expose `description` on headers, params, form-urlencoded entries, and multipart entries.

## Proposed Design

### Data model

Use the existing request field shapes as the source of truth:

- `HttpRequestHeader.description`
- `HttpRequestParam.description`
- `FormUrlEncodedEntry.description`
- `MultipartFormEntry.description`
- `HttpRequestParam.type`
- `MultipartFormEntry.type`

No schema changes are required.

### Rendering model

Normalize each supported parameter source into a docs-only table row model with these fields:

- `name`
- `value`
- `parameterType`
- `description`
- `enabled`

This normalized model will be used to drive consistent tables for all parameter-like request fields.

### UI sections

Render the following sections only when data exists:

- `Query Parameters`
- `Path Parameters`
- `Headers`
- `Form Fields`
- `Multipart Fields`

Each table should include:

- `Name`
- `Value`
- `Type` when meaningful
- `Description`
- disabled state badge column

Headers can omit `Type` if there is no meaningful field-level type to show.

### Description rendering

Descriptions should support the same `Description` shapes already used elsewhere:

- plain string
- structured markdown text

The docs UI should render them through the existing markdown renderer so rich descriptions work consistently.

## File Impact

- `packages/oc-docs/src/components/Docs/Item/Item.tsx`
  - add normalization helpers and richer parameter tables
- `packages/oc-docs/src/sampleCollection.ts`
  - add descriptions and path/query/form/multipart examples
- `packages/oc-docs/e2e/requests.spec.ts`
  - add coverage for newly documented parameter rendering

## Testing Strategy

- Add Playwright coverage for:
  - query param type and description rendering
  - path param section rendering
  - header description rendering
  - form-urlencoded field documentation rendering
  - multipart field documentation rendering
- Keep existing request/body tests passing to guard against regressions.

## Risks

- The current table component may render markdown content awkwardly if descriptions are passed as raw React nodes; normalization needs to account for that cleanly.
- Legacy sample data mixes root-level and nested request shapes, so the implementation must keep current helper usage intact.
