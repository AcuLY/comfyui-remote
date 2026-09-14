import assert from 'node:assert/strict';
import test from 'node:test';
import { boundVariants, compileSection, resolveProductionVariant } from '../src/production-domain.mjs';

function fixture() {
  const store = { presets: [
    { id: 'a', name: '角色', categoryId: 'character', variants: [
      { id: 'a-default', prompt: 'DEFAULT', negative: '', loras: [] },
      { id: 'a-linked', prompt: 'CHARACTER', negative: 'NEG_CHARACTER', loras: [{ id: 'la', stage: 1, path: 'a.safetensors' }], linkedVariants: [{ variantId: 'b-default' }] },
    ] },
    { id: 'b', name: '风格', categoryId: 'style', variants: [{ id: 'b-default', prompt: 'STYLE', negative: 'NEG_STYLE', loras: [{ id: 'lb', stage: 1, path: 'b.safetensors' }, { id: 'lb2', stage: 2, path: 'refine.safetensors' }] }] },
  ], sortRules: { positive: ['style', 'character'], negative: ['character', 'style'], lora1: ['style', 'character'], lora2: ['character', 'style'] } };
  const section = { presetIds: ['a'], bindings: [{ id: 'binding-a', presetId: 'a', variantId: 'a-linked' }], promptBlocks: [{ id: 'custom', positive: 'CUSTOM', negative: 'NEG_CUSTOM' }, { id: 'cached', bindingId: 'binding-a', positive: 'STALE_CACHED', negative: '' }], loras: [{ id: 'cached-lora', bindingId: 'binding-a', path: 'cached.safetensors', stage: 1 }] };
  return { store, section };
}

test('template imports use their bound variant, then an explicit local choice', () => {
  const { store, section } = fixture();
  assert.equal(boundVariants(section, store)[0].variant.id, 'a-linked');
  section.presetVariants = { a: 'a-default' };
  assert.equal(boundVariants(section, store)[0].variant.id, 'a-default');
});

test('linked text and LoRAs follow independent compilation orders without editor-cache duplication', () => {
  const { store, section } = fixture();
  const compiled = compileSection(section, store);
  assert.equal(compiled.prompt, 'CUSTOM, STYLE, CHARACTER');
  assert.equal(compiled.negative, 'NEG_CUSTOM, NEG_CHARACTER, NEG_STYLE');
  assert.deepEqual(compiled.loras.map(l => l.path), ['b.safetensors', 'a.safetensors', 'refine.safetensors']);
});

test('local source disabling applies to recursive LoRAs without changing the preset', () => {
  const { store, section } = fixture();
  const before = structuredClone(store);
  section.disabledPresetLoras = ['binding-a:b-default:lb'];
  assert.deepEqual(compileSection(section, store).loras.map(l => l.path), ['a.safetensors', 'refine.safetensors']);
  assert.deepEqual(store, before);
});

test('missing and cyclic references reject generation instead of silently omitting content', () => {
  const { store, section } = fixture();
  store.presets[1].variants[0].linkedVariants = [{ variantId: 'a-linked' }];
  assert.throws(() => compileSection(section, store), { code: 'VARIANT_CYCLE' });
  assert.throws(() => resolveProductionVariant(store, 'missing'), { code: 'VARIANT_MISSING' });
  section.presetIds = ['deleted']; section.bindings = [];
  assert.throws(() => compileSection(section, store), { code: 'PRESET_MISSING' });
});
