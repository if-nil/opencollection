import React, { memo } from 'react';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-http';
import 'prismjs/components/prism-graphql';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-xml-doc';
import 'prismjs/components/prism-python';
import type {
  BodyAnnotation,
  BodyAnnotationDescription,
  BodyAnnotationDetails,
  BodyAnnotations,
  FormUrlEncodedBody,
  HttpRequest,
  HttpRequestHeader,
  HttpRequestParam,
  MultipartFormBody
} from '@opencollection/types/requests/http';
import type { Description, StructuredText } from '@opencollection/types/common/description';
import type { Variable } from '@opencollection/types/common/variables';
import { generateSectionId, getItemId } from '../../../utils/itemUtils';
import {
  getItemType,
  getItemName,
  getItemDocs,
  getHttpMethod,
  getRequestUrl,
  getHttpHeaders,
  getHttpBody,
  getHttpParams,
  getRequestAuth,
  getRequestVariables,
  getRequestAssertions,
  getRequestScripts,
  getRequestExamples,
  scriptsArrayToObject,
  isFolder,
  isHttpRequest
} from '../../../utils/schemaHelpers';
import {
  MinimalDataTable,
  CompactCodeView,
  StatusBadge
} from '../../../ui/MinimalComponents';
import { CodeSnippets } from '../CodeSnippets/CodeSnippets';
import { StyledWrapper } from './StyledWrapper';
import { Scripts } from './Scripts/Scripts';
import { Examples } from './Examples/ExamplesView/ExamplesView';
import { useMarkdownRenderer } from '../../../hooks';

const methodColors: Record<string, string> = {
  GET: '#10b981',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  PATCH: '#a855f7',
  DELETE: '#ef4444',
  HEAD: '#8b5cf6',
  OPTIONS: '#06b6d4'
};

interface BodySchemaAnnotation {
  path: string;
  dataType?: string;
  description?: BodyAnnotationDescription;
}

interface BodySchemaNode {
  path: string;
  label: string;
  depth: number;
  dataType?: string;
  description?: BodyAnnotationDescription;
  children: BodySchemaNode[];
}

type DocumentedFieldDescription = Description | BodyAnnotationDescription | undefined;

interface DocumentedFieldRow {
  name: string;
  value: string;
  type?: string;
  description?: DocumentedFieldDescription;
  enabled: boolean;
}

const isStructuredText = (value: unknown): value is StructuredText =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as StructuredText).content === 'string' &&
  typeof (value as StructuredText).type === 'string';

const isBodyAnnotationDetails = (value: unknown): value is BodyAnnotationDetails =>
  !!value &&
  typeof value === 'object' &&
  !isStructuredText(value) &&
  ('dataType' in value || 'description' in value);

const getAnnotationDescription = (annotation: BodyAnnotation): BodyAnnotationDescription | undefined => {
  if (typeof annotation === 'string' || isStructuredText(annotation)) {
    return annotation;
  }

  if (isBodyAnnotationDetails(annotation)) {
    return annotation.description;
  }

  return undefined;
};

const getAnnotationDataType = (annotation: BodyAnnotation): string | undefined => {
  if (isBodyAnnotationDetails(annotation)) {
    return annotation.dataType;
  }

  return undefined;
};

const getBodySchemaAnnotations = (body: unknown): BodySchemaAnnotation[] => {
  if (!body || typeof body !== 'object' || !('annotations' in body)) {
    return [];
  }

  const annotations = (body as { annotations?: BodyAnnotations }).annotations;
  if (!annotations || typeof annotations !== 'object') {
    return [];
  }

  return Object.entries(annotations).map(([path, annotation]) => ({
    path,
    dataType: getAnnotationDataType(annotation),
    description: getAnnotationDescription(annotation)
  }));
};

const buildBodySchemaTree = (annotations: BodySchemaAnnotation[]): BodySchemaNode[] => {
  const roots: BodySchemaNode[] = [];
  const nodes = new Map<string, BodySchemaNode>();

  const ensureNode = (path: string, depth: number): BodySchemaNode => {
    const existing = nodes.get(path);
    if (existing) {
      return existing;
    }

    const parts = path.split('.');
    const label = parts[parts.length - 1] || path;
    const node: BodySchemaNode = {
      path,
      label,
      depth,
      children: []
    };
    nodes.set(path, node);

    if (parts.length === 1) {
      roots.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join('.');
      const parent = ensureNode(parentPath, depth - 1);
      parent.children.push(node);
    }

    return node;
  };

  annotations.forEach((annotation) => {
    const parts = annotation.path.split('.');
    parts.forEach((_, index) => {
      ensureNode(parts.slice(0, index + 1).join('.'), index);
    });

    const node = ensureNode(annotation.path, parts.length - 1);
    node.dataType = annotation.dataType;
    node.description = annotation.description;
  });

  const flatten = (items: BodySchemaNode[]): BodySchemaNode[] =>
    items.flatMap((item) => [item, ...flatten(item.children)]);

  return flatten(roots);
};

const normalizeTableValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (value === null || value === undefined) {
    return '';
  }

  return typeof value === 'string' ? value : String(value);
};

const getDocumentedParamRows = (
  params: HttpRequestParam[] | undefined,
  paramType: 'query' | 'path'
): DocumentedFieldRow[] => {
  if (!params || params.length === 0) {
    return [];
  }

  return params
    .filter((param) => param.type === paramType)
    .map((param) => ({
      name: param.name,
      value: param.value,
      type: param.type,
      description: param.description,
      enabled: param.disabled !== true
    }));
};

const getDocumentedHeaderRows = (headers: HttpRequestHeader[] | undefined): DocumentedFieldRow[] => {
  if (!headers || headers.length === 0) {
    return [];
  }

  return headers.map((header) => ({
    name: header.name,
    value: header.value,
    description: header.description,
    enabled: header.disabled !== true
  }));
};

const getBodyDocumentedFieldRows = (body: unknown): {
  formFields: DocumentedFieldRow[];
  multipartFields: DocumentedFieldRow[];
} => {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !('type' in body)) {
    return {
      formFields: [],
      multipartFields: []
    };
  }

  if ((body as FormUrlEncodedBody).type === 'form-urlencoded') {
    const formBody = body as FormUrlEncodedBody;
    return {
      formFields: formBody.data
        .filter((entry) => entry.disabled !== true)
        .map((entry) => ({
          name: entry.name,
          value: entry.value,
          type: 'form-urlencoded',
          description: entry.description,
          enabled: true
        })),
      multipartFields: []
    };
  }

  if ((body as MultipartFormBody).type === 'multipart-form') {
    const multipartBody = body as MultipartFormBody;
    return {
      formFields: [],
      multipartFields: multipartBody.data
        .filter((entry) => entry.disabled !== true)
        .map((entry) => ({
          name: entry.name,
          value: normalizeTableValue(entry.value),
          type: entry.type,
          description: entry.description,
          enabled: true
        }))
    };
  }

  return {
    formFields: [],
    multipartFields: []
  };
};

const Item = memo(({
  item,
  parentPath = '',
  collection,
  toggleRunnerMode,
  onTryClick
}: {
  item: any;
  parentPath?: string;
  collection?: any;
  toggleRunnerMode?: () => void;
  onTryClick?: () => void;
}) => {
  const md = useMarkdownRenderer();
  const itemId = getItemId(item);
  const sectionId = generateSectionId(item, parentPath);
  const renderDescription = (description: DocumentedFieldDescription) => {
    if (!description) {
      return null;
    }

    if (typeof description === 'string') {
      return <span>{description}</span>;
    }

    return (
      <div
        dangerouslySetInnerHTML={{
          __html: md.render(description.content)
        }}
      />
    );
  };

  const documentedFieldColumns = (includeType: boolean) => [
    { key: 'name', label: 'Name', width: includeType ? '18%' : '22%' },
    { key: 'value', label: 'Value', width: includeType ? '22%' : '28%' },
    ...(includeType
      ? [{ key: 'type', label: 'Type', width: '14%' }]
      : []),
    {
      key: 'description',
      label: 'Description',
      width: includeType ? '31%' : '35%',
      render: (_value: unknown, row: DocumentedFieldRow) => renderDescription(row.description)
    },
    {
      key: 'enabled',
      label: '',
      width: '15%',
      render: (value: boolean) => value ? null : <StatusBadge status="inactive" text="Disabled" />
    }
  ];

  if (isFolder(item)) {
    const folderItem = item as any;
    const folderName = getItemName(folderItem) || 'Untitled Folder';
    const folderDocs = getItemDocs(folderItem);
    const folderHeaders = folderItem.request?.headers || [];
    const folderVariables = getRequestVariables(folderItem);
    const folderScripts = scriptsArrayToObject(getRequestScripts(folderItem));

    return (
      <StyledWrapper
        key={itemId}
        id={`section-${sectionId}`}
      >
        <div className="item-header-minimal">
          <div className="item-title-section">
            <div className="item-type-badge folder">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span>Folder</span>
            </div>
            <h1 className="item-title">{folderName}</h1>
          </div>
        </div>

        {folderDocs && (
          <div className="item-docs">
            <div dangerouslySetInnerHTML={{ __html: md.render(String(folderDocs)) }} />
          </div>
        )}

        <div className="item-content-grid">
          {folderHeaders && folderHeaders.length > 0 && (
            <MinimalDataTable
              data={folderHeaders}
              title="Headers"
              columns={[
                { key: 'name', label: 'Name', width: '30%' },
                { key: 'value', label: 'Value', width: '50%' },
                { key: 'enabled', label: '', width: '20%', render: (val: any) => val === false ? <StatusBadge status="inactive" text="Disabled" /> : null }
              ]}
            />
          )}

          {folderVariables && folderVariables.length > 0 && (
            <MinimalDataTable
              data={folderVariables.map((v: Variable) => ({
                name: v.name,
                value: v.value || '',
                enabled: !v.disabled
              }))}
              title="Variables"
              columns={[
                { key: 'name', label: 'Name', width: '40%' },
                { key: 'value', label: 'Value', width: '40%' },
                { key: 'enabled', label: '', width: '20%', render: (val) => <StatusBadge status={val ? 'active' : 'inactive'} /> }
              ]}
            />
          )}

          <Scripts
            preRequest={folderScripts.preRequest}
            postResponse={folderScripts.postResponse}
          />
        </div>
      </StyledWrapper>
    );
  }

  const itemType = getItemType(item);
  
  if (itemType === 'script') {
    const scriptItem = item as any;
    const scriptName = getItemName(scriptItem) || 'Untitled Script';

    return (
      <StyledWrapper
        key={itemId}
        id={`section-${sectionId}`}
      >
        <div className="item-header-minimal">
          <div className="item-title-section">
            <div className="item-type-badge script">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
              </svg>
              <span>Script</span>
            </div>
            <h1 className="item-title">{scriptName}</h1>
          </div>
        </div>

        {scriptItem.script && (
          <CompactCodeView
            code={scriptItem.script}
            language="javascript"
          />
        )}
      </StyledWrapper>
    );
  }

  if (itemType === 'http') {
    const httpItem = item as HttpRequest;
    const scripts = scriptsArrayToObject(getRequestScripts(httpItem));

    const examples = getRequestExamples(httpItem);
    const body = getHttpBody(httpItem) || { mode: 'none' };
    const bodySchemaNodes = buildBodySchemaTree(getBodySchemaAnnotations(body));
    const queryParamRows = getDocumentedParamRows(getHttpParams(httpItem), 'query');
    const pathParamRows = getDocumentedParamRows(getHttpParams(httpItem), 'path');
    const headerRows = getDocumentedHeaderRows(getHttpHeaders(httpItem));
    const { formFields, multipartFields } = getBodyDocumentedFieldRows(body);

    const endpoint = {
      id: itemId,
      name: getItemName(httpItem) || 'Untitled',
      method: getHttpMethod(httpItem),
      url: getRequestUrl(httpItem),
      description: getItemDocs(httpItem) || '',
      headers: getHttpHeaders(httpItem),
      body,
      params: getHttpParams(httpItem),
      auth: getRequestAuth(httpItem) || { mode: 'none' },
      vars: getRequestVariables(httpItem),
      assertions: getRequestAssertions(httpItem),
      tests: '',
      script: scripts,
      examples
    };

    return (
      <StyledWrapper
        key={itemId}
        id={`section-${sectionId}`}
      >
        <div className="item-header-minimal">
          <div className="item-title-section">
            <h1 className="item-title">{endpoint.name}</h1>
            <div className="endpoint-badges">
              <span className="badge-method" style={{ backgroundColor: methodColors[endpoint.method?.toUpperCase()] }}>
                {endpoint.method}
              </span>
              <span className="badge-url">{endpoint.url}</span>
              {(onTryClick || toggleRunnerMode) && (
                <button
                  className="badge-try"
                  onClick={() => {
                    if (onTryClick) {
                      onTryClick();
                    } else if (toggleRunnerMode) {
                      toggleRunnerMode();
                    }
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Try
                </button>
              )}
            </div>
          </div>
        </div>

        {endpoint.description && (
          <div className="item-docs">
            <div dangerouslySetInnerHTML={{ __html: md.render(endpoint.description) }} />
          </div>
        )}

        <div className="item-content-main">
          <div className="request-details">
            {queryParamRows.length > 0 && (
              <MinimalDataTable
                data={queryParamRows}
                title="Query Parameters"
                columns={documentedFieldColumns(true)}
              />
            )}

            {pathParamRows.length > 0 && (
              <MinimalDataTable
                data={pathParamRows}
                title="Path Parameters"
                columns={documentedFieldColumns(true)}
              />
            )}

            {headerRows.length > 0 && (
              <MinimalDataTable
                data={headerRows}
                title="Headers"
                columns={documentedFieldColumns(false)}
              />
            )}

            {endpoint.body && typeof endpoint.body === 'object' && 'data' in endpoint.body && (
              <div className="request-body-section">
                <h3 className="section-title">Body</h3>
                <CompactCodeView
                  code={(() => {
                    const bodyData = (endpoint.body as any).data;
                    const bodyType = (endpoint.body as any).type;
                    
                    // Handle different body types
                    if (bodyType === 'form-urlencoded' && Array.isArray(bodyData)) {
                      // Convert FormUrlEncodedEntry[] to string
                      return bodyData
                        .filter((entry: any) => entry.disabled !== true)
                        .map((entry: any) => `${encodeURIComponent(entry.name)}=${encodeURIComponent(entry.value)}`)
                        .join('&');
                    } else if (bodyType === 'multipart-form' && Array.isArray(bodyData)) {
                      // Convert MultipartFormEntry[] to readable format
                      return bodyData
                        .filter((entry: any) => entry.disabled !== true)
                        .map((entry: any) => `${entry.name}: ${entry.value}`)
                        .join('\n');
                    } else if (typeof bodyData === 'string') {
                      // Handle string data (json, text, xml, etc.)
                      return bodyData;
                    } else {
                      // Fallback: stringify objects
                      return JSON.stringify(bodyData, null, 2);
                    }
                  })()}
                  language={(() => {
                    const bodyType = (endpoint.body as any).type;
                    if (bodyType === 'form-urlencoded') return 'text';
                    if (bodyType === 'multipart-form') return 'text';
                    return bodyType || 'json';
                  })()}
                />
                {formFields.length > 0 && (
                  <MinimalDataTable
                    data={formFields}
                    title="Form Fields"
                    columns={documentedFieldColumns(true)}
                  />
                )}
                {multipartFields.length > 0 && (
                  <MinimalDataTable
                    data={multipartFields}
                    title="Multipart Fields"
                    columns={documentedFieldColumns(true)}
                  />
                )}
                {bodySchemaNodes.length > 0 && (
                  <div className="body-schema-tree">
                    <h3 className="section-title">Body Schema</h3>
                    <div className="body-schema-list">
                      {bodySchemaNodes.map((node) => (
                        <div
                          key={node.path}
                          className="body-schema-row"
                          style={{ '--schema-depth': node.depth } as React.CSSProperties}
                        >
                          <div className="body-schema-field">
                            <code className="annotation-path">{node.label}</code>
                            {node.dataType && (
                              <span className="body-schema-type">{node.dataType}</span>
                            )}
                          </div>
                          {node.description && (
                            <div className="annotation-description">
                              {typeof node.description === 'string' ? (
                                <span>{node.description}</span>
                              ) : (
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: md.render(node.description.content)
                                  }}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Scripts
              preRequest={endpoint.script?.preRequest}
              postResponse={endpoint.script?.postResponse}
            />
          </div>

          <div className="code-snippets-wrapper">
            <CodeSnippets
              method={endpoint.method}
              url={endpoint.url}
              headers={endpoint.headers}
              body={endpoint.body}
            />
          </div>
        </div>

        {endpoint.examples && endpoint.examples.length > 0 && (
          <Examples
            examples={endpoint.examples}
            method={endpoint.method}
            url={endpoint.url}
          />
        )}
      </StyledWrapper>
    );
  }

  return (
    <StyledWrapper
      key={itemId}
      id={`section-${sectionId}`}
    >
      <div className="item-header-minimal">
        <h1 className="item-title">{getItemName(item) || 'Untitled Item'}</h1>
        <p className="item-subtitle">Unsupported item type: {itemType}</p>
      </div>
    </StyledWrapper>
  );
}, (prevProps, nextProps) => {
  if (getItemType(prevProps.item) !== getItemType(nextProps.item)) {
    return false;
  }

  const prevItemId = getItemId(prevProps.item);
  const nextItemId = getItemId(nextProps.item);
  if (prevItemId !== nextItemId) {
    return false;
  }

  return (
    prevProps.parentPath === nextProps.parentPath
  );
});

export default Item;

