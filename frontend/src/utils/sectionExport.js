/**
 * sectionExport.js
 *
 * Client-side section export shaper.
 *
 * exportSection(sectionType, rawData)
 *   → Returns a clean { section, title, exportedAt, payload } object
 *     that is sent to the backend /api/projects/:id/export endpoint.
 *
 * Each shaper picks ONLY the fields relevant to its section so the
 * backend never receives cross-section data.
 */

// ─── Section shapers ────────────────────────────────────────────────────────

function shapeOverview(data) {
  if (!data) return {};
  return {
    health: data.health || {},
    snapshots: data.snapshots || [],
    recommendations: data.recommendations || [],
    alerts: data.alerts || [],
    jobs: data.jobs || [],
  };
}

function shapeMetrics(data) {
  if (!data) return {};
  const { metrics = {}, trends = {}, growth = {} } = data;
  return {
    repository: {
      stars:        metrics.stars        ?? 0,
      forks:        metrics.forks        ?? 0,
      watchers:     metrics.watchers     ?? 0,
      contributors: metrics.contributorsCount ?? 0,
      commits:      metrics.commitsCount ?? 0,
    },
    issues: {
      open:         metrics.issues?.open   ?? 0,
      closed:       metrics.issues?.closed ?? 0,
    },
    traffic_14d: {
      views:          metrics.traffic?.views          ?? 0,
      unique_visitors: metrics.traffic?.uniqueVisitors ?? 0,
      clones:         metrics.traffic?.clones          ?? 0,
    },
    trends: {
      stars_growth_pct:  trends.starsGrowth  ?? 0,
      forks_growth_pct:  trends.forksGrowth  ?? 0,
      commit_trend:      trends.commitTrend  ?? 'stable',
      activity_score:    trends.activityScore ?? 0,
    },
    growth_analytics: {
      star_growth_rate_pct:     growth.starGrowthRate       ?? 0,
      star_trend_direction:     growth.starTrendDirection    ?? 'stable',
      stars_per_day_7d_avg:     growth.starsMovingAvgPerDay ?? 0,
      new_stars_365d:           growth.totalNewStars365d    ?? 0,
      commit_growth_rate_pct:   growth.commitGrowthRate      ?? 0,
      avg_commits_per_week:     growth.avgCommitsPerWeek     ?? 0,
    },
  };
}

function shapeActivity(data) {
  if (!data) return {};
  return {
    commits: {
      total:          data.commits?.totalCommits       ?? 0,
      trend:          data.commits?.trend               ?? 'stable',
      timeline:       (data.commits?.commitsOverTime ?? []).map(c => ({
        date:  c.date,
        count: c.count,
      })),
      heatmap:        data.commits?.heatmap            ?? [],
    },
    star_history: (data.starHistory ?? []).map(s => ({
      date:  s.date,
      count: s.count,
    })),
    contributors: {
      total:        data.contributors?.totalContributors ?? 0,
      bus_factor:   data.contributors?.busFactor          ?? 0,
      risk_level:   data.contributors?.riskLevel          ?? 'low',
      top_10:       (data.contributors?.contributors ?? []).slice(0, 10).map(c => ({
        login:     c.login || c.name,
        avatar:    c.avatar_url || c.avatar || null,
        commits:   c.commits   ?? 0,
        additions: c.additions ?? 0,
        deletions: c.deletions ?? 0,
      })),
    },
    pull_requests: {
      open:           data.prs?.open       ?? 0,
      merged:         data.prs?.merged     ?? 0,
      merge_rate_pct: data.prs?.mergeRate  ?? 0,
      avg_cycle_time_hours:  data.prs?.avgCycleTimeHours  ?? 0,
      avg_review_time_hours: data.prs?.avgReviewTimeHours ?? 0,
    },
    issues: {
      open:                   data.issues?.open                  ?? 0,
      closed:                 data.issues?.closed                ?? 0,
      stale:                  data.issues?.stale                 ?? 0,
      avg_close_time_hours:   data.issues?.avgTimeToCloseHours   ?? 0,
      bug_to_feature_ratio:   data.issues?.bugToFeatureRatio     ?? 0,
    },
    dora_metrics: {
      deployment_frequency:    data.dora?.deploymentFrequency      ?? null,
      lead_time_hours:         data.dora?.leadTimeForChangesHours   ?? null,
      change_failure_rate_pct: data.dora?.changeFailureRate         ?? null,
      time_to_restore_hours:   data.dora?.timeToRestoreServiceHours ?? null,
      performance: {
        deployment:  data.dora?.performance?.deploymentFrequency ?? null,
        lead_time:   data.dora?.performance?.leadTime            ?? null,
        failure_rate: data.dora?.performance?.changeFailureRate  ?? null,
        restore:     data.dora?.performance?.timeToRestore       ?? null,
      },
    },
  };
}

function shapeAiAnalysis(payload) {
  if (!payload) return {};
  // The API returns an envelope: { ready: true, status: "completed", data: { ... } }
  const data = payload.data || payload; // fallback if it's already unwrapped
  
  return {
    generated_at:       data.generated_at       ?? null,
    status:             data.status             ?? payload.status ?? 'unknown',
    issues_data:        data.issues_data        || {},
    suggestions_data:   data.suggestions_data   || {},
    risk_data:          data.risk_data          || {},
    tech_trend_data:    data.tech_trend_data    || {},
    future_score_data:  data.future_score_data  || {},
    code_quality_score: data.code_quality_score ?? 0,
  };
}

function shapeRepoTree(data) {
  return {
    tree: typeof data?.tree === 'object'
      ? JSON.stringify(data.tree, null, 2)
      : (data?.tree ?? ''),
  };
}

function shapeCodeQuality(data) {
  if (!data) return {};
  return {
    security: {
      has_license:          data.security?.hasLicense          ?? false,
      has_readme:           data.security?.hasReadme           ?? false,
      readme_quality_score: data.security?.readmeQualityScore  ?? 0,
      secrets_found:        data.security?.secretsFound        ?? false,
      issues:               data.security?.issues              ?? [],
    },
    tech_stack: {
      languages:   (data.techStack?.languages  ?? []).map(l => ({ name: l.name, percentage: l.percentage })),
      frameworks:  data.techStack?.frameworks  ?? [],
      dependencies: {
        total:    data.techStack?.dependencies?.total    ?? 0,
        outdated: data.techStack?.dependencies?.outdated ?? 0,
        risky:    data.techStack?.dependencies?.risky    ?? 0,
      },
    },
    high_churn_files: (data.churn?.hotFiles ?? []).slice(0, 10).map(f => ({
      file:        f.file,
      churn_score: f.churnScore,
    })),
    complex_files: (data.complexity?.complexFiles ?? []).slice(0, 10).map(f => ({
      file:             f.file,
      complexity_score: f.complexityScore,
    })),
    commit_hygiene: {
      conventional_commits_pct: data.commitPatterns?.conventionalCommitsUsage ?? 0,
      message_quality_score:    data.commitPatterns?.messageQualityScore       ?? 0,
      commit_types: {
        feat:     data.commitPatterns?.commitTypes?.feat     ?? 0,
        fix:      data.commitPatterns?.commitTypes?.fix      ?? 0,
        refactor: data.commitPatterns?.commitTypes?.refactor ?? 0,
        chore:    data.commitPatterns?.commitTypes?.chore    ?? 0,
      },
    },
  };
}

// ─── Section title map ────────────────────────────────────────────────────────

const SECTION_TITLES = {
  overview:     'Project Overview',
  metrics:      'Repository Metrics',
  activity:     'Repository Activity',
  ai_analysis:  'AI Analysis Report',
  repo_tree:    'Repository Structure',
  code_quality: 'Code Quality & Architecture',
};

// ─── Empty-data guards ────────────────────────────────────────────────────────

/**
 * isSectionEmpty(sectionType, rawData)
 *
 * Returns true when there is no meaningful data to export for this section.
 * Each check is intentionally lenient — it only returns true when the data
 * is genuinely absent, not when numeric values happen to be 0.
 *
 * @param {string} sectionType
 * @param {*}      rawData  — raw API response (may be null / undefined / {})
 * @returns {boolean}
 */
export function isSectionEmpty(sectionType, rawData) {
  if (rawData === null || rawData === undefined) return true;

  switch (sectionType) {
    case 'overview':
      if (typeof rawData !== 'object') return true;
      if (rawData.message) return true;
      return (
        !rawData.health &&
        (!rawData.snapshots || rawData.snapshots.length === 0) &&
        (!rawData.recommendations || rawData.recommendations.length === 0) &&
        (!rawData.alerts || rawData.alerts.length === 0) &&
        (!rawData.jobs || rawData.jobs.length === 0)
      );

    case 'activity': {
      if (typeof rawData !== 'object') return true;
      if (rawData.message) return true;
      return (
        !rawData.commits &&
        !rawData.contributors &&
        !rawData.prs &&
        !rawData.issues
      );
    }

    case 'metrics': {
      if (typeof rawData !== 'object') return true;
      if (rawData.message) return true;
      // Genuinely empty when the metrics object itself is absent
      const m = rawData.metrics;
      return !m || (
        m.stars === undefined &&
        m.forks === undefined &&
        m.commitsCount === undefined
      );
    }

    case 'ai_analysis':
      // No report has been generated yet
      if (!rawData || rawData.message) return true;
      return !rawData.generated_at && rawData.status !== 'completed';

    case 'repo_tree': {
      const tree = rawData?.tree;
      if (!tree) return true;
      const str = typeof tree === 'object' ? JSON.stringify(tree) : tree;
      return str.trim().length === 0;
    }

    case 'code_quality':
      if (!rawData || rawData.message) return true;
      // Must have at least one of the four quality sub-sections
      return (
        !rawData.churn &&
        !rawData.commitPatterns &&
        !rawData.techStack &&
        !rawData.security
      );

    default:
      return !rawData || Object.keys(rawData).length === 0;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * exportSection(sectionType, rawData)
 *
 * Normalizes raw API data for the given section into a clean export payload.
 * Returns an object ready to POST to /api/projects/:id/export:
 *   { section, title, exportedAt, payload }
 *
 * @param {string} sectionType  One of: overview | metrics | activity | ai_analysis | repo_tree | code_quality
 * @param {object} rawData      Raw response from the corresponding API call
 * @returns {{ section: string, title: string, exportedAt: string, payload: object }}
 */
export function exportSection(sectionType, rawData) {
  const shapers = {
    overview:     shapeOverview,
    metrics:      shapeMetrics,
    activity:     shapeActivity,
    ai_analysis:  shapeAiAnalysis,
    repo_tree:    shapeRepoTree,
    code_quality: shapeCodeQuality,
  };

  const shaper = shapers[sectionType];
  if (!shaper) {
    throw new Error(`Unknown section type: "${sectionType}". Valid types: ${Object.keys(shapers).join(', ')}`);
  }

  return {
    section:     sectionType,
    title:       SECTION_TITLES[sectionType] ?? sectionType,
    exportedAt:  new Date().toISOString(),
    payload:     shaper(rawData),
  };
}
