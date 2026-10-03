// Display-only parsing of top-level JSON strings received so far. A partial
// preview never becomes a publishable draft: the backend validates the final
// complete JSON separately. Strings are rendered as React text, never HTML.
export function streamingFields(input: string): Record<string, string> {
  const fields: Record<string, string> = Object.create(null);
  const escapes: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
  const readString = (start: number) => {
    let value = '';
    for (let i = start + 1; i < input.length; i++) {
      const char = input[i];
      if (char === '"') return { value, next: i + 1, complete: true };
      if (char !== '\\') { value += char; continue; }
      const escape = input[++i];
      if (escape === 'u') {
        const hex = input.slice(i + 1, i + 5);
        if (!/^[\da-f]{4}$/i.test(hex)) break;
        value += String.fromCharCode(Number.parseInt(hex, 16)); i += 4;
      } else if (Object.prototype.hasOwnProperty.call(escapes, escape)) value += escapes[escape];
      else break;
    }
    return { value, next: input.length, complete: false };
  };
  let depth = 0;
  for (let i = 0; i < input.length;) {
    const char = input[i];
    if (char === '{' || char === '[') { depth++; i++; continue; }
    if (char === '}' || char === ']') { depth--; i++; continue; }
    if (char !== '"') { i++; continue; }
    const key = readString(i); i = key.next;
    if (!key.complete) break;
    if (depth !== 1) continue;
    while (/\s/.test(input[i] || '') && i < input.length) i++;
    if (input[i] !== ':') continue;
    i++;
    while (/\s/.test(input[i] || '') && i < input.length) i++;
    if (input[i] !== '"') continue;
    const value = readString(i); fields[key.value] = value.value; i = value.next;
    if (!value.complete) break;
  }
  return fields;
}
