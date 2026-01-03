/**
 * Dynamic Field Filtering Utility
 * 
 * Allows clients to request only specific fields from API responses.
 * Supports nested fields using dot notation (e.g., "billing.first_name", "line_items.name").
 * 
 * Usage:
 * - Query parameter: ?fields=id,name,status,line_items.name,line_items.image.src
 * - If no fields specified, returns all data (backward compatible)
 */

interface FieldFilterOptions {
  fields?: string[];
  includeMetaData?: boolean; // Always include meta_data for orders (medication_schedule)
}

/**
 * Filters an object to include only specified fields
 * Supports nested fields using dot notation
 */
export function filterFields<T extends Record<string, any>>(
  data: T,
  requestedFields?: string[],
  options: FieldFilterOptions = {}
): Partial<T> {
  // If no fields specified, return all data (backward compatible)
  if (!requestedFields || requestedFields.length === 0) {
    return data;
  }

  // Always include meta_data for orders if specified
  if (options.includeMetaData && data.meta_data) {
    // Ensure meta_data is included even if not explicitly requested
    if (!requestedFields.includes('meta_data')) {
      requestedFields.push('meta_data');
    }
  }

  const result: any = {};

  for (const field of requestedFields) {
    const fieldParts = field.split('.');
    const fieldName = fieldParts[0];

    if (fieldParts.length === 1) {
      // Simple field
      if (data.hasOwnProperty(fieldName)) {
        result[fieldName] = data[fieldName];
      }
    } else {
      // Nested field (e.g., "billing.first_name" or "line_items.name")
      if (data.hasOwnProperty(fieldName)) {
        const nestedValue = data[fieldName];

        if (Array.isArray(nestedValue)) {
          // Handle arrays (e.g., line_items)
          result[fieldName] = nestedValue.map((item: any) => {
            return filterNestedField(item, fieldParts.slice(1));
          });
        } else if (typeof nestedValue === 'object' && nestedValue !== null) {
          // Handle objects (e.g., billing, shipping)
          const nestedResult = filterNestedField(nestedValue, fieldParts.slice(1));
          if (Object.keys(nestedResult).length > 0) {
            result[fieldName] = nestedResult;
          }
        }
      }
    }
  }

  return result;
}

/**
 * Helper function to filter nested fields
 */
function filterNestedField(obj: any, fieldParts: string[]): any {
  if (fieldParts.length === 0 || !obj) {
    return obj;
  }

  const [currentField, ...remainingParts] = fieldParts;

  if (remainingParts.length === 0) {
    // Last field in the path
    return obj.hasOwnProperty(currentField) ? { [currentField]: obj[currentField] } : {};
  }

  // More nested levels
  if (obj.hasOwnProperty(currentField)) {
    const nestedValue = obj[currentField];

    if (Array.isArray(nestedValue)) {
      return nestedValue.map((item: any) => filterNestedField(item, remainingParts));
    } else if (typeof nestedValue === 'object' && nestedValue !== null) {
      const nestedResult = filterNestedField(nestedValue, remainingParts);
      return Object.keys(nestedResult).length > 0 ? { [currentField]: nestedResult } : {};
    }
  }

  return {};
}

/**
 * Filters an array of objects
 */
export function filterFieldsArray<T extends Record<string, any>>(
  dataArray: T[],
  requestedFields?: string[],
  options: FieldFilterOptions = {}
): Partial<T>[] {
  if (!dataArray || !Array.isArray(dataArray)) {
    return [];
  }

  return dataArray.map((item) => filterFields(item, requestedFields, options));
}

/**
 * Parses fields query parameter from URL
 * Supports comma-separated values: ?fields=id,name,status
 */
export function parseFieldsParam(fieldsParam: string | null): string[] | undefined {
  if (!fieldsParam) {
    return undefined;
  }

  // Split by comma and trim whitespace
  return fieldsParam
    .split(',')
    .map((field) => field.trim())
    .filter((field) => field.length > 0);
}

/**
 * Predefined field sets for common use cases
 */
export const FIELD_SETS = {
  subscriptions: {
    list: [
      'id',
      'number',
      'status',
      'date_created',
      'next_payment_date',
      'end_date',
      'currency',
      'total',
      'billing_period',
      'billing_interval',
      'line_items.name',
      'line_items.image.src',
    ],
    detail: [
      'id',
      'number',
      'status',
      'date_created',
      'next_payment_date',
      'end_date',
      'currency',
      'total',
      'billing_period',
      'billing_interval',
      'billing.first_name',
      'billing.last_name',
      'billing.address_1',
      'billing.address_2',
      'billing.city',
      'billing.state',
      'billing.postcode',
      'billing.country',
      'billing.email',
      'billing.phone',
      'shipping.first_name',
      'shipping.last_name',
      'shipping.address_1',
      'shipping.address_2',
      'shipping.city',
      'shipping.state',
      'shipping.postcode',
      'shipping.country',
      'line_items.name',
      'line_items.quantity',
      'line_items.total',
      'line_items.image.src',
      'payment_method_title',
      'payment_method',
      'shipping_total',
      'shipping_method',
    ],
  },
  orders: {
    list: [
      'id',
      'number',
      'date_created',
      'status',
      'total',
      'currency',
      'line_items.name',
      'line_items.quantity',
      'line_items.total',
      'line_items.image.src',
      'meta_data',
    ],
    treatment: [
      'id',
      'date_created',
      'meta_data',
      'line_items.name',
      'line_items.image.src',
    ],
  },
};

