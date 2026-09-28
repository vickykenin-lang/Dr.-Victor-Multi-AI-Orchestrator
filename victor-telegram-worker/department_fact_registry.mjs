const FACT_SOURCES = Object.freeze({
  rio: Object.freeze({
    instagram_last_post: Object.freeze({
      url: 'https://raw.githubusercontent.com/vickykenin-lang/rio-affiliate-engine/main/data/ig_published.json',
      source_label: 'rio-affiliate-engine/data/ig_published.json',
      parser: 'rio_posted_map',
    }),
  }),
  aura3: Object.freeze({
    instagram_last_post: Object.freeze({
      url: 'https://raw.githubusercontent.com/vickykenin-lang/aura-3.0/main/content/published.json',
      source_label: 'aura-3.0/content/published.json',
      parser: 'aura_published_map',
    }),
  }),
});

export function getDepartmentFactSource(department, factType) {
  const source = FACT_SOURCES?.[String(department || '')]?.[String(factType || '')] || null;
  return source ? { ...source } : null;
}

function validDate(value) {
  return value && Number.isFinite(Date.parse(value));
}

export function extractDepartmentFact(source, payload) {
  if (!source || !payload || typeof payload !== 'object') return null;

  if (source.parser === 'rio_posted_map') {
    const posted = payload?.posted && typeof payload.posted === 'object' ? payload.posted : {};
    const entries = Object.entries(posted)
      .map(([recordId, value]) => ({ recordId, ...(value || {}) }))
      .filter(item => validDate(item.posted_at))
      .sort((a, b) => Date.parse(b.posted_at) - Date.parse(a.posted_at));
    if (!entries.length) return null;
    const latest = entries[0];
    return {
      fact_type: 'instagram_last_post',
      timestamp: latest.posted_at,
      record_id: latest.recordId,
      title: latest.product_name || null,
      url: latest.permalink || null,
      media_id: latest.media_id || null,
    };
  }

  if (source.parser === 'aura_published_map') {
    const entries = Object.entries(payload)
      .map(([recordId, value]) => ({ recordId, ...(value || {}) }))
      .map(item => ({ recordId: item.recordId, platform: item.instagram || null, source: item.source || null }))
      .filter(item => validDate(item.platform?.at))
      .sort((a, b) => Date.parse(b.platform.at) - Date.parse(a.platform.at));
    if (!entries.length) return null;
    const latest = entries[0];
    return {
      fact_type: 'instagram_last_post',
      timestamp: latest.platform.at,
      record_id: latest.recordId,
      title: latest.source,
      url: latest.platform.url || null,
      media_id: latest.platform.id || null,
    };
  }

  return null;
}

export function formatDepartmentFact({ departmentName, fact, sourceLabel, fetchedAt }) {
  if (!fact) {
    return `${departmentName} Instagram fact\nLast verified post: NOT_AVAILABLE\nFetched at: ${fetchedAt}\nSource: ${sourceLabel}; no LLM-generated fact.`;
  }
  const lines = [
    `${departmentName} Instagram fact`,
    `Last verified post: ${fact.timestamp}`,
  ];
  if (fact.record_id) lines.push(`Record: ${fact.record_id}`);
  if (fact.title) lines.push(`Detail: ${fact.title}`);
  if (fact.url) lines.push(`Permalink: ${fact.url}`);
  lines.push(`Fetched at: ${fetchedAt}`);
  lines.push(`Source: ${sourceLabel}; no LLM-generated fact.`);
  return lines.join('\n');
}

export function listRegisteredDepartmentFacts() {
  return Object.entries(FACT_SOURCES).flatMap(([department, facts]) =>
    Object.keys(facts).map(fact_type => ({ department, fact_type })),
  );
}
