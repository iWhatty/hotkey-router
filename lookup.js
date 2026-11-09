// Read user-keyed tables without treating prototype properties as entries.
export function ownValue(table, key) {
  return table != null && Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined
}
