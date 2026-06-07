import { X_PATHS } from './endpoints';

export interface ApiEndpointMetadata {
  queryId: string;
  operationName: string;
  metadata?: {
    featureSwitches?: string[];
  };
}

export type FeatureSwitchDefaults = Record<string, { value: boolean }>;

const EXPORTS_REGEX = /exports\s*=/g;
const API_FILE_REGEX = /api["']?\s*:\s*["']?([A-Za-z0-9_-]+)["']?/;
const MAIN_FILE_REGEX = /main[.\w-]*?\.js/;
const FEATURE_SWITCH_PREFIX_REGEX =
  /["']?featureSwitch["']?\s*:\s*{["']?defaultConfig["']?\s*:/;

export class XApiUpdater {
  getApiFileUrl(pageSource: string): string | undefined {
    const fileName = pageSource.match(API_FILE_REGEX)?.[1];

    return fileName
      ? `${X_PATHS.TWITTER_CDN}/api.${fileName}a.js`
      : undefined;
  }

  getMainFileUrl(pageSource: string): string | undefined {
    const fileName = pageSource.match(MAIN_FILE_REGEX)?.[0];

    return fileName ? `${X_PATHS.TWITTER_CDN}/${fileName}` : undefined;
  }

  parseApiEndpoints(pageSource: string | string[]): ApiEndpointMetadata[] {
    const source = Array.isArray(pageSource)
      ? pageSource.join('\n')
      : pageSource;
    const endpoints: ApiEndpointMetadata[] = [];

    for (const match of source.matchAll(EXPORTS_REGEX)) {
      if (match.index === undefined) {
        continue;
      }

      try {
        endpoints.push(
          parseLooseObject(
            extractBalancedObject(source, match.index + match[0].length),
          ) as ApiEndpointMetadata,
        );
      } catch {
        continue;
      }
    }

    return endpoints.filter(
      (endpoint) => endpoint.queryId && endpoint.operationName,
    );
  }

  mapEndpoints(
    currentEndpoints: Record<string, string>,
    newEndpoints: ApiEndpointMetadata[],
  ): Record<string, string> {
    const byOperation = new Map(
      newEndpoints.map((endpoint) => [
        endpoint.operationName,
        `${endpoint.queryId}/${endpoint.operationName}`,
      ]),
    );
    const mapped: Record<string, string> = {};

    for (const [key, value] of Object.entries(currentEndpoints)) {
      const operationName = value.split('/').at(-1);
      const nextValue = operationName ? byOperation.get(operationName) : undefined;

      if (nextValue) {
        mapped[key] = nextValue;
      }
    }

    return mapped;
  }

  getFeatureSwitches(pageSource: string): FeatureSwitchDefaults {
    const prefix = pageSource.match(FEATURE_SWITCH_PREFIX_REGEX);

    if (!prefix || prefix.index === undefined) {
      return {};
    }

    const objectStart = prefix.index + prefix[0].length;
    const rawDefaults = extractBalancedObject(pageSource, objectStart);

    return parseLooseObject(rawDefaults) as FeatureSwitchDefaults;
  }
}

function extractBalancedObject(source: string, startIndex: number): string {
  const start = source.indexOf('{', startIndex);

  if (start === -1) {
    throw new Error('Could not find feature switch defaultConfig object.');
  }

  let depth = 0;
  let inString: '"' | "'" | null = null;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error('Unbalanced feature switch defaultConfig object.');
}

function parseLooseObject(source: string): unknown {
  const jsonLike = source
    .replace(/([{,])\s*([A-Za-z_$][\w$-]*)\s*:/g, '$1"$2":')
    .replace(/'/g, '"');

  return JSON.parse(jsonLike);
}
