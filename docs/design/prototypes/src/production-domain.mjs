// Pure current-section compilation for the production prototype.
// Templates keep references as well as cached editor previews; only live references
// participate in compilation, so imported preview text and LoRAs are never doubled.

export class ProductionCompileError extends Error {
  constructor(message, code) { super(message); this.name = 'ProductionCompileError'; this.code = code; }
}

export function boundVariants(section, store) {
  const bindings = section.bindings || [];
  const ids = new Set(Array.isArray(section.presetIds) ? section.presetIds : bindings.map(binding => binding.presetId));
  const records = [...bindings.filter(binding => ids.has(binding.presetId))];
  for (const id of ids) if (!records.some(binding => binding.presetId === id)) records.push({ presetId: id });
  return records.map(binding => {
    const preset = (store.presets || []).find(item => item.id === binding.presetId);
    if (!preset) throw new ProductionCompileError('绑定的预制已不存在：' + binding.presetId, 'PRESET_MISSING');
    const variantId = section.presetVariants?.[preset.id] ?? binding.variantId ?? preset.variants?.[0]?.id;
    const variant = preset.variants?.find(item => item.id === variantId);
    if (!variant) throw new ProductionCompileError('预制“' + preset.name + '”的变体已不存在', 'VARIANT_MISSING');
    return { preset, variant, binding, bindingId: binding.id || preset.id };
  });
}

export function resolveProductionVariant(store, variantId) {
  const lookup = new Map((store.presets || []).flatMap(preset => (preset.variants || []).map(variant => [variant.id, { preset, variant }])));
  function visit(id, ancestors) {
    if (ancestors.includes(id)) throw new ProductionCompileError('检测到预制变体循环引用：' + [...ancestors, id].join(' → '), 'VARIANT_CYCLE');
    const record = lookup.get(id);
    if (!record) throw new ProductionCompileError('引用的预制变体已不存在：' + id, 'VARIANT_MISSING');
    const { preset, variant } = record;
    const fragment = { presetId: preset.id, presetName: preset.name, categoryId: preset.categoryId, variantId: variant.id, prompt: variant.prompt || '', negative: variant.negative || '', loras: (variant.loras || []).map(lora => ({ ...lora })) };
    return [fragment, ...(variant.linkedVariants || []).flatMap(reference => visit(typeof reference === 'string' ? reference : reference.variantId, [...ancestors, id]))];
  }
  const fragments = visit(variantId, []);
  return { prompt: fragments.map(fragment => fragment.prompt).filter(Boolean).join(', '), negative: fragments.map(fragment => fragment.negative).filter(Boolean).join(', '), loras: fragments.flatMap(fragment => fragment.loras), fragments };
}

export function manualPromptBlocks(section) {
  if (section.promptBlocks?.length) return section.promptBlocks.filter(block => !block.bindingId && !block.presetId);
  return section.prompt || section.negative ? [{ id: 'base', name: '自定义提示词', positive: section.prompt || '', negative: section.negative || '' }] : [];
}

function categoryOrder(records, order = []) {
  const ranks = new Map(order.map((id, index) => [id, index]));
  const rank = item => item.categoryId == null ? -1 : (ranks.get(item.categoryId) ?? ranks.size);
  return records.map((item, index) => ({ item, index })).sort((left, right) => rank(left.item) - rank(right.item) || left.index - right.index).map(({ item }) => item);
}

export function resolvedSectionBindings(section, store) {
  return boundVariants(section, store).map(bound => ({ ...bound, resolved: resolveProductionVariant(store, bound.variant.id) }));
}

export function inheritedSectionLoras(section, store) {
  return resolvedSectionBindings(section, store).flatMap(({ preset, variant, bindingId, resolved }) => resolved.fragments.flatMap(fragment => fragment.loras.map((lora, index) => {
    const localId = lora.id || 'lora-' + index;
    const id = fragment.variantId === variant.id ? bindingId + ':' + localId : bindingId + ':' + fragment.variantId + ':' + localId;
    return { ...lora, id, legacyId: preset.id + ':' + localId, presetId: preset.id, sourcePresetId: fragment.presetId, sourceVariantId: fragment.variantId, categoryId: fragment.categoryId, source: preset.name, stage: lora.stage || 1 };
  })));
}

export function compileSection(section, store) {
  const bindings = resolvedSectionBindings(section, store);
  const custom = manualPromptBlocks(section).map(block => ({ categoryId: block.categoryId, prompt: block.positive || '', negative: block.negative || '' }));
  const text = [...custom, ...bindings.flatMap(({ resolved }) => resolved.fragments)];
  const disabled = new Set(section.disabledPresetLoras || []);
  const manualLoras = (section.loras || []).filter(lora => !lora.bindingId && !lora.presetId).map(lora => ({ ...lora, stage: lora.stage || 1 }));
  const loras = [...manualLoras, ...inheritedSectionLoras(section, store)].filter(lora => lora.enabled !== false && !disabled.has(lora.id) && !disabled.has(lora.legacyId));
  const rules = store.sortRules || {};
  return {
    prompt: categoryOrder(text, rules.positive).map(fragment => fragment.prompt).filter(Boolean).join(', '),
    negative: categoryOrder(text, rules.negative).map(fragment => fragment.negative).filter(Boolean).join(', '),
    loras: [...categoryOrder(loras.filter(lora => lora.stage === 1), rules.lora1), ...categoryOrder(loras.filter(lora => lora.stage === 2), rules.lora2)],
  };
}
