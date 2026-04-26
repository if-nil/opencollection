# HTTP Parameter Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the generated API docs to document query params, path params, headers, form-urlencoded fields, and multipart fields using existing request metadata.

**Architecture:** Keep the change local to the docs package by normalizing request field sources into a single table row shape in the docs renderer. Reuse current request helper functions and markdown rendering so the feature ships without schema changes.

**Tech Stack:** React, TypeScript, Playwright, OpenCollection request types

---

### Task 1: Add failing docs coverage for documented parameters

**Files:**
- Modify: `packages/oc-docs/e2e/requests.spec.ts`
- Modify: `packages/oc-docs/src/sampleCollection.ts`

- [ ] **Step 1: Write the failing tests**

```ts
test('query parameter rows render type and description', async ({ page }) => {
  const section = endpointSection(page, 'search users');
  const paramsTable = section.locator('.minimal-table').filter({ hasText: 'Query Parameters' });

  await expect(paramsTable.getByRole('cell', { name: 'query', exact: true })).toBeVisible();
  await expect(paramsTable.getByRole('cell', { name: 'Full-text search term.', exact: true })).toBeVisible();
});

test('path parameters render in a dedicated table', async ({ page }) => {
  const section = endpointSection(page, 'get user by id');
  const paramsTable = section.locator('.minimal-table').filter({ hasText: 'Path Parameters' });

  await expect(paramsTable.getByRole('cell', { name: 'id', exact: true })).toBeVisible();
  await expect(paramsTable.getByRole('cell', { name: 'path', exact: true })).toBeVisible();
  await expect(paramsTable.getByRole('cell', { name: 'User identifier from the URL path.', exact: true })).toBeVisible();
});

test('headers render descriptions', async ({ page }) => {
  const section = endpointSection(page, 'update user');
  const headersTable = section.locator('.minimal-table').filter({ hasText: 'Headers' });

  await expect(headersTable.getByRole('cell', { name: 'Bearer access token for the current operator.', exact: true })).toBeVisible();
});

test('form-urlencoded bodies render documented fields', async ({ page }) => {
  const section = endpointSection(page, 'submit form');
  const formTable = section.locator('.minimal-table').filter({ hasText: 'Form Fields' });

  await expect(formTable.getByRole('cell', { name: 'email', exact: true })).toBeVisible();
  await expect(formTable.getByRole('cell', { name: 'Sender email address.', exact: true })).toBeVisible();
});

test('multipart bodies render documented fields with entry types', async ({ page }) => {
  const section = endpointSection(page, 'upload file');
  const formTable = section.locator('.minimal-table').filter({ hasText: 'Multipart Fields' });

  await expect(formTable.getByRole('cell', { name: 'file', exact: true })).toBeVisible();
  await expect(formTable.getByRole('cell', { name: 'file', exact: true })).toBeVisible();
  await expect(formTable.getByRole('cell', { name: 'Primary document to upload.', exact: true })).toBeVisible();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:e2e --workspace @opencollection/docs -- e2e/requests.spec.ts`
Expected: FAIL because the docs UI does not yet render the new description/type cells or dedicated path/form tables.

- [ ] **Step 3: Add sample data that exercises the failing cases**

```ts
params: [
  {
    name: 'id',
    value: '42',
    type: 'path',
    description: 'User identifier from the URL path.'
  }
]
```

- [ ] **Step 4: Re-run the focused suite and confirm the failures are feature-related**

Run: `npm run test:e2e --workspace @opencollection/docs -- e2e/requests.spec.ts`
Expected: FAIL assertions about missing rendered content, not startup or syntax errors.

- [ ] **Step 5: Commit**

```bash
git add packages/oc-docs/e2e/requests.spec.ts packages/oc-docs/src/sampleCollection.ts
git commit -m "test: cover request parameter documentation"
```

### Task 2: Implement unified parameter documentation tables

**Files:**
- Modify: `packages/oc-docs/src/components/Docs/Item/Item.tsx`

- [ ] **Step 1: Write the minimal docs-only row model and helpers**

```ts
interface DocumentedFieldRow {
  name: string;
  value: string;
  parameterType?: string;
  description?: Description;
  enabled: boolean;
}
```

- [ ] **Step 2: Normalize request sources into the shared row model**

```ts
const mapParamRows = (params: HttpRequestParam[], paramType: 'query' | 'path') =>
  params
    .filter((param) => param.type === paramType)
    .map((param) => ({
      name: param.name,
      value: param.value,
      parameterType: param.type,
      description: param.description,
      enabled: param.disabled !== true
    }));
```

- [ ] **Step 3: Add a shared column builder that renders markdown descriptions**

```ts
const renderDescription = (description: Description | undefined) => {
  if (!description) return null;
  if (typeof description === 'string') return <span>{description}</span>;
  return <div dangerouslySetInnerHTML={{ __html: md.render(description.content) }} />;
};
```

- [ ] **Step 4: Replace the simple query/header tables with richer section-specific tables**

```tsx
{queryParamRows.length > 0 && (
  <MinimalDataTable
    data={queryParamRows}
    title="Query Parameters"
    columns={documentedParameterColumns}
  />
)}
```

- [ ] **Step 5: Render `Form Fields` and `Multipart Fields` alongside the existing body preview**

```tsx
{formFieldRows.length > 0 && (
  <MinimalDataTable
    data={formFieldRows}
    title="Form Fields"
    columns={documentedParameterColumns}
  />
)}
```

- [ ] **Step 6: Run the focused suite to verify the new UI passes**

Run: `npm run test:e2e --workspace @opencollection/docs -- e2e/requests.spec.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/oc-docs/src/components/Docs/Item/Item.tsx
git commit -m "feat: document request parameters in docs"
```

### Task 3: Regression check the existing body-schema behavior

**Files:**
- Reuse: `packages/oc-docs/e2e/requests.spec.ts`

- [ ] **Step 1: Run the same request docs suite after implementation**

Run: `npm run test:e2e --workspace @opencollection/docs -- e2e/requests.spec.ts`
Expected: PASS for both old body-schema assertions and the new parameter-documentation assertions.

- [ ] **Step 2: Summarize any residual risk**

```text
Residual risk is limited to non-HTTP request docs and any table styling issues for unusually long markdown descriptions.
```

- [ ] **Step 3: Commit if additional cleanup was needed**

```bash
git add packages/oc-docs/e2e/requests.spec.ts packages/oc-docs/src/components/Docs/Item/Item.tsx packages/oc-docs/src/sampleCollection.ts
git commit -m "test: verify docs parameter rendering regressions"
```
