export function exportEligibility(project, store) {
  const images = store.images.filter(image => image.projectId === project.id && !image.trashed);
  const kept = images.filter(image => image.review === 'kept');
  const covers = images.filter(image => image.tags?.includes('cover'));
  const selected = images.filter(image => image.tags?.some(tag => ['cover', 'featured', 'preview'].includes(tag)));
  const missing = selected.filter(image => !image.censored);
  const issues = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug || '')) issues.push('请在项目信息中填写小写字母、数字或连字符组成的英文标识。');
  if (project.slug && store.projects.some(other => other.id !== project.id && other.slug === project.slug)) issues.push('英文标识已被其他项目使用。');
  if (covers.length !== 1) issues.push(`需要恰好一张封面，当前为 ${covers.length} 张。`);
  if (!kept.length) issues.push('至少保留一张图片才能导出。');
  if (missing.length) issues.push(`${missing.length} 张用途图片还没有打码版本。`);
  return { kept, covers, selected, missing, issues };
}
