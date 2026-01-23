/**
 * Utility functions for formatting weight and height values.
 * Weight is always in lbs. Height is always in feet and inches.
 */

/**
 * Cleans a weight value by removing any existing unit labels
 * @param weightValue - The weight value string (e.g., "90 lbs", "86.2")
 * @returns The numeric value as a string without units
 */
export function cleanWeightValue(weightValue: string): string {
  if (!weightValue || weightValue === 'N/A') return weightValue;

  return weightValue
    .replace(/\s*(lbs?|pounds?)\s*/gi, '')
    .trim();
}

/**
 * Formats a weight value with lbs label
 * @param weightValue - The weight value (may contain units or be just a number)
 * @returns Formatted weight string with "lbs"
 */
export function formatWeight(weightValue: string): string {
  if (!weightValue || weightValue === 'N/A') return 'N/A';

  const cleanedValue = cleanWeightValue(weightValue);
  return `${cleanedValue} lbs`;
}

/**
 * Formats height - returns the feet+inches string if available
 * @param feetValue - The feet+inches value (e.g., "5'10\"")
 * @param heightValue - Fallback height value in inches
 * @returns Formatted height string
 */
export function formatHeight(
  feetValue: string | null | undefined,
  heightValue: string | null | undefined
): string {
  if (feetValue) {
    return feetValue;
  }

  if (!heightValue || heightValue === 'N/A') return 'N/A';

  return heightValue;
}
