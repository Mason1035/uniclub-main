import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';
const source = await readFile(new URL('../src/pages/admin/ai/streaming.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { streamingFields } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('live preview reads every partial JSON boundary without guessing title text', () => {
  const raw = JSON.stringify({ title: '合成标题', excerpt: '第一行\n第二行', content: '包含 "引号" 和 \\ 路径' });
  for (let end = 0; end <= raw.length; end++) assert.doesNotThrow(() => streamingFields(raw.slice(0, end)));
  assert.deepEqual({ ...streamingFields(raw) }, JSON.parse(raw));
  assert.equal(streamingFields('{"title":"实时标').title, '实时标');
});
test('live preview handles partial escapes and excludes nested values', () => {
  assert.equal(streamingFields('{"title":"a\\u4e').title, 'a');
  assert.equal(streamingFields('{"title":"a\\u4e2d"}').title, 'a中');
  const parsed = streamingFields('{"location":{"title":"不应当作标题"},"tags":["测试"],"title":"真实顶层字段"}');
  assert.deepEqual({ ...parsed }, { title: '真实顶层字段' });
});
test('live preview cannot change object prototypes or create a publishable draft', () => {
  const parsed = streamingFields('{"__proto__":"test","content":"<script>test</script>"}');
  assert.equal(Object.getPrototypeOf(parsed), null);
  assert.equal(parsed.content, '<script>test</script>');
  assert.equal(parsed.structured, undefined);
  assert.deepEqual({ ...streamingFields('一段普通 Markdown，标题无法推断') }, {});
});
