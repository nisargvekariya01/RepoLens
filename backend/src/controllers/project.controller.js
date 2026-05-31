const { ObjectId } = require("mongodb");
const { getDb } = require("../config/db");
const { generateCsv, generatePdf } = require("../utils/exportUtils");
const { safeDecryptToken } = require("../utils/tokenEncryption");
const { checkRepoLimit } = require("../utils/subscriptionLimits");

/**
 * Resolve a plaintext GitHub token from a user document.
 * Prefers encrypted field; falls back to legacy plaintext.
 */
function resolveTokenFromUser(user) {
  if (user?.github?.access_token_encrypted) {
    const dec = safeDecryptToken(user.github.access_token_encrypted);
    if (dec) return dec;
  }
  return user?.github_access_token || process.env.GITHUB_TOKEN || null;
}

/**
 * Utility to parse GitHub URL and extract owner and repo name.
 * Supported formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 */
function parseGithubUrl(url) {
  try {
    const cleanedUrl = url.trim().replace(/\.git$/, "");
    const parts = new URL(cleanedUrl).pathname.split("/").filter(Boolean);
    if (parts.length < 2) return { owner: null, repo: null };
    return { owner: parts[0], repo: parts[1] };
  } catch (error) {
    return { owner: null, repo: null };
  }
}

/**
 * Create a new project.
 */
async function createProject(req, res) {
  const { name, description, github_url, local_path } = req.body;
  const user_id = req.user.id;

  try {
    await checkRepoLimit(user_id, req.user.email);
  } catch (limitErr) {
    return res.status(limitErr.statusCode || 403).json({ error: limitErr.message });
  }

  if (!name || !github_url) {
    return res.status(400).json({ error: "Name and GitHub URL are required." });
  }

  const { owner, repo } = parseGithubUrl(github_url);
  if (!owner || !repo) {
    return res.status(400).json({ error: "Invalid GitHub URL." });
  }

  const fs = require("fs");
  if (local_path && local_path.trim() !== "") {
    try {
      if (!fs.existsSync(local_path.trim())) {
        return res.status(400).json({ error: "Provided local path does not exist on the server." });
      }
      const stat = fs.statSync(local_path.trim());
      if (!stat.isDirectory()) {
        return res.status(400).json({ error: "Local path must be a valid directory." });
      }
    } catch (e) {
      return res.status(400).json({ error: "Error accessing local path." });
    }
  }

  try {
    const db = getDb();

    // Resolve the user's GitHub token to check repo visibility
    const user = await db.collection("users").findOne({ _id: new ObjectId(user_id) });
    const token = resolveTokenFromUser(user);

    // Detect repo visibility before saving
    const axios = require("axios");
    let visibility = "public";
    try {
      const headers = { Accept: "application/vnd.github+json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const ghRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
        headers,
        timeout: 8000,
      });
      visibility = ghRes.data.private ? "private" : "public";
    } catch (visErr) {
      const status = visErr.response?.status;
      if (status === 404 || status === 401 || status === 403) {
        // Likely private repo and no valid token
        if (!token) {
          return res.status(403).json({
            error: "This repository is private or does not exist. Connect your GitHub account to access private repositories.",
            requiresGitHub: true,
          });
        }
        // Token provided but still 404 = doesn't exist or no access
        return res.status(404).json({ error: "Repository not found or your token does not have access to it." });
      }
      // Non-fatal: proceed without visibility metadata
    }

    const newProject = {
      user_id: new ObjectId(user_id),
      name,
      description,
      github_url,
      repo_owner: owner,
      repo_name: repo,
      local_path: local_path ? local_path.trim() : null,
      visibility,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await db.collection("projects").insertOne(newProject);
    res.status(201).json({
      id: result.insertedId,
      ...newProject,
    });
  } catch (error) {
    console.error("Create project error:", error.message);
    res.status(500).json({ error: "Failed to create project." });
  }
}

/**
 * List all projects for the authenticated user.
 */
async function listProjects(req, res) {
  const user_id = req.user.id;

  try {
    const db = getDb();
    const projects = await db
      .collection("projects")
      .find({ user_id: new ObjectId(user_id) })
      .toArray();

    res.status(200).json(projects.map(p => ({
      id: p._id,
      name: p.name,
      description: p.description,
      github_url: p.github_url,
      repo_owner: p.repo_owner,
      repo_name: p.repo_name,
      visibility: p.visibility || "public",
      created_at: p.created_at,
      updated_at: p.updated_at
    })));
  } catch (error) {
    console.error("List projects error:", error.message);
    res.status(500).json({ error: "Failed to list projects." });
  }
}

/**
 * Get a single project by ID (with ownership check).
 */
async function getProject(req, res) {
  const { id } = req.params;
  const user_id = req.user.id;

  try {
    const db = getDb();
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(id),
      user_id: new ObjectId(user_id),
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found or unauthorized." });
    }

    res.status(200).json({
      id: project._id,
      name: project.name,
      description: project.description,
      github_url: project.github_url,
      repo_owner: project.repo_owner,
      repo_name: project.repo_name,
      created_at: project.created_at,
      updated_at: project.updated_at
    });
  } catch (error) {
    console.error("Get project error:", error.message);
    res.status(500).json({ error: "Failed to fetch project." });
  }
}

/**
 * Update a project (with ownership check).
 */
async function updateProject(req, res) {
  const { id } = req.params;
  const { name, description, github_url } = req.body;
  const user_id = req.user.id;

  try {
    const db = getDb();
    const updateData = { updated_at: new Date() };
    
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (github_url) {
      const { owner, repo } = parseGithubUrl(github_url);
      if (!owner || !repo) {
        return res.status(400).json({ error: "Invalid GitHub URL." });
      }
      updateData.github_url = github_url;
      updateData.repo_owner = owner;
      updateData.repo_name = repo;
    }

    const result = await db.collection("projects").findOneAndUpdate(
      { _id: new ObjectId(id), user_id: new ObjectId(user_id) },
      { $set: updateData },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({ error: "Project not found or unauthorized." });
    }

    const p = result;
    res.status(200).json({
      id: p._id,
      name: p.name,
      description: p.description,
      github_url: p.github_url,
      repo_owner: p.repo_owner,
      repo_name: p.repo_name,
      created_at: p.created_at,
      updated_at: p.updated_at
    });
  } catch (error) {
    console.error("Update project error:", error.message);
    res.status(500).json({ error: "Failed to update project." });
  }
}

/**
 * Delete a project and all related data (cascade delete).
 */
async function deleteProject(req, res) {
  const { id } = req.params;
  const user_id = req.user.id;

  try {
    const db = getDb();
    const projectId = new ObjectId(id);

    // Verify ownership first
    const project = await db.collection("projects").findOne({
      _id: projectId,
      user_id: new ObjectId(user_id),
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found or unauthorized." });
    }

    // Cascade delete related data
    await db.collection("projects").deleteOne({ _id: projectId });
    await db.collection("project_snapshots").deleteMany({ project_id: projectId });
    await db.collection("recommendations").deleteMany({ project_id: projectId });
    await db.collection("alerts").deleteMany({ project_id: projectId });
    await db.collection("jobs").deleteMany({ project_id: projectId });
    await db.collection("file_analysis").deleteMany({ project_id: projectId });
    await db.collection("module_analysis").deleteMany({ project_id: projectId });
    await db.collection("ai_reports").deleteMany({ project_id: projectId });

    res.status(200).json({ message: "Project and related data deleted successfully." });
  } catch (error) {
    console.error("Delete project error:", error.message);
    res.status(500).json({ error: "Failed to delete project." });
  }
}

/**
 * Get project file tree in ASCII format.
 */
async function getProjectTree(req, res) {
  const { id } = req.params;
  const user_id = req.user.id;

  try {
    const db = getDb();
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(id),
      user_id: new ObjectId(user_id),
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found or unauthorized." });
    }

    const user = await db.collection("users").findOne({ _id: new ObjectId(user_id) });
    const token = resolveTokenFromUser(user);
    const format = req.query.format === "json" ? "json" : "ascii";

    const { fetchAndGenerateTree } = require("../utils/fileTree");
    const tree = await fetchAndGenerateTree(project.repo_owner, project.repo_name, token, 5, format);

    res.status(200).json({ tree });
  } catch (error) {
    console.error("Get project tree error:", error.message);
    res.status(500).json({ error: "Failed to generate repository tree." });
  }
}

/**
 * Get unified repo metrics and calculated trends.
 */
async function getProjectMetrics(req, res) {
  const { id } = req.params;
  const user_id = req.user.id;

  try {
    const db = getDb();
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(id),
      user_id: new ObjectId(user_id),
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found or unauthorized." });
    }

    if (!project.repo_owner || !project.repo_name) {
      return res.status(400).json({ error: "Invalid repo URL or repository configuration." });
    }

    const user = await db.collection("users").findOne({ _id: new ObjectId(user_id) });
    const token = resolveTokenFromUser(user);

    const githubService = require("../services/github.service");
    const { calculateMetricsTrends } = require("../utils/metricsCalculator");
    const { analyzeTrend } = require("../utils/trendAnalysis");
    const trendsService = require("../services/github.trends.service");
    const { filterByTimeRange } = require("../utils/timeFilter");

    // 1. Fetch live metrics + star/commit history in parallel
    const [metrics, rawStars, rawCommits] = await Promise.all([
      githubService.getRepoMetrics(project.repo_owner, project.repo_name, token),
      trendsService.getStarsHistory(project.repo_owner, project.repo_name, token).catch(() => []),
      trendsService.getCommitsHistory(project.repo_owner, project.repo_name, token).catch(() => []),
    ]);

    // 2. Fetch past metrics (closest to 30 days ago, or fallback to the first record ever synced)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let pastSnapshot = await db.collection("project_snapshots")
      .find({ project_id: new ObjectId(id), snapshot_date: { $lte: thirtyDaysAgo } })
      .sort({ snapshot_date: -1 })
      .limit(1)
      .next();

    if (!pastSnapshot) {
      pastSnapshot = await db.collection("project_snapshots")
        .find({ project_id: new ObjectId(id) })
        .sort({ snapshot_date: 1 })
        .limit(1)
        .next();
    }

    let pastMetrics = {};
    if (pastSnapshot) {
      pastMetrics = {
        stars: pastSnapshot.repo_meta?.stars || 0,
        forks: pastSnapshot.repo_meta?.forks || 0,
        commitsCount: pastSnapshot.commit_count || 0,
        issues: { closed: pastSnapshot.issue_stats?.closed_count || 0 }
      };
    }

    // 3. Base trend calculator (activity score, star/fork growth %)
    const trends = calculateMetricsTrends(metrics, pastMetrics);

    // 4. Growth Analytics — migrated from removed Trends tab, no data loss
    const stars30d   = filterByTimeRange(rawStars,   "30d",  { dateKey: "date" });
    const commits30d = filterByTimeRange(rawCommits, "30d",  { dateKey: "date" });
    const stars365d  = filterByTimeRange(rawStars,   "365d", { dateKey: "date" });

    const starTrendAnalysis   = analyzeTrend(stars30d,   7, { valueKey: "count", dateKey: "date" });
    const commitTrendAnalysis = analyzeTrend(commits30d, 7, { valueKey: "count", dateKey: "date" });

    const totalCommits30d = commits30d.reduce((s, d) => s + (d.count || 0), 0);
    const avgCommitsPerWeek = Number((totalCommits30d / (30 / 7)).toFixed(1));
    const totalNewStars365d = stars365d.reduce((s, d) => s + (d.count || 0), 0);

    const growth = {
      starGrowthRate:        starTrendAnalysis.growthRate,
      starTrendDirection:    starTrendAnalysis.trendDirection,
      starsMovingAvgPerDay:  starTrendAnalysis.movingAverage,
      starPeaks:             starTrendAnalysis.peaks.slice(0, 5),
      totalNewStars365d,
      commitGrowthRate:        commitTrendAnalysis.growthRate,
      commitTrendDirection:    commitTrendAnalysis.trendDirection,
      commitsMovingAvgPerDay:  commitTrendAnalysis.movingAverage,
      commitPeaks:             commitTrendAnalysis.peaks.slice(0, 5),
      avgCommitsPerWeek,
    };

    // Forward _partial so frontend can show a "limited data" notice
    res.status(200).json({ metrics, trends, growth, partial: metrics._partial || false });
  } catch (error) {
    console.error("Get project metrics error:", error.message);
    res.status(500).json({ error: "Failed to load project metrics." });
  }
}

/**
 * GET /api/projects/:id/activity
 * Orchestrates commit/contributor/PR/issue fetches and returns full analytics.
 */
async function getProjectActivity(req, res) {
  const { id } = req.params;
  const user_id = req.user.id;
  const granularity = req.query.granularity || "day"; // day | week | month

  try {
    const db = getDb();

    // ── Resolve project & auth token ────────────────────────────────────────
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(id),
      user_id: new ObjectId(user_id),
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found or unauthorized." });
    }

    const { repo_owner: owner, repo_name: repo } = project;
    if (!owner || !repo) {
      return res.status(400).json({ error: "Project has no valid GitHub repository configured." });
    }

    const user = await db.collection("users").findOne({ _id: new ObjectId(user_id) });
    const token = resolveTokenFromUser(user);

    // ── Load all analytics utilities (lazy require keeps startup fast) ──────
    const activitySvc      = require("../services/github.activity.service");
    const { processCommitAnalytics }       = require("../utils/commitAnalytics");
    const { processContributorAnalytics }  = require("../utils/contributorAnalytics");
    const { processPrIssueAnalytics }      = require("../utils/prIssueAnalytics");
    const { calculateDoraMetrics }         = require("../utils/doraMetrics");
    const trendsService                    = require("../services/github.trends.service");

    // ── Fetch all data sets in parallel (includes star history for Activity graph) ──
    let rawCommits, rawContributors, rawPRs, rawIssues, rawStarHistory;

    try {
      [rawCommits, rawContributors, rawPRs, rawIssues, rawStarHistory] = await Promise.all([
        activitySvc.getCommits(owner, repo, token,      { maxPages: 5 }),
        activitySvc.getContributors(owner, repo, token, { maxPages: 3 }),
        activitySvc.getPullRequests(owner, repo, token, { maxPages: 5 }),
        activitySvc.getIssues(owner, repo, token,       { maxPages: 5 }),
        trendsService.getStarsHistory(owner, repo, token).catch(() => []),
      ]);
    } catch (fetchErr) {
      const status = fetchErr.response?.status;
      if (status === 403 || status === 429) {
        return res.status(429).json({
          error: status === 429
            ? "GitHub API rate limit exceeded. Please add a GITHUB_TOKEN or try again later."
            : "GitHub access denied (403). The repository may be private or the token is invalid.",
        });
      }
      throw fetchErr; // re-throw unexpected errors
    }

    // ── Process through analytics utilities ─────────────────────────────────
    const commitAnalytics      = processCommitAnalytics(rawCommits, { granularity });
    const contributorAnalytics = processContributorAnalytics(rawContributors, rawCommits);
    const prIssueAnalytics     = processPrIssueAnalytics(rawPRs, rawIssues);
    const dora                 = calculateDoraMetrics(rawCommits, rawPRs, rawIssues);

    res.status(200).json({
      commits:      commitAnalytics,
      contributors: contributorAnalytics,
      prs:          prIssueAnalytics.pullRequests,
      issues:       prIssueAnalytics.issues,
      dora,
      starHistory:  rawStarHistory || [],
      meta: {
        owner,
        repo,
        granularity,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[getProjectActivity] error:", error.message);
    res.status(500).json({ error: "Failed to load activity analytics." });
  }
}

/**
 * GET /api/projects/:id/code-quality
 * Scan repo files, git history and run code quality analysis utilities.
 */
async function getProjectCodeQuality(req, res) {
  const { id } = req.params;
  const user_id = req.user.id;

  try {
    const db = getDb();
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(id),
      user_id: new ObjectId(user_id),
    });

    if (!project || !project.repo_owner || !project.repo_name || !project.github_url) {
      return res.status(400).json({ error: "Invalid repository or project not found." });
    }

    const { scanFiles } = require("../utils/fileScanner");
    const { analyzeCodeChurn } = require("../utils/codeChurn");
    const { analyzeCommitPatterns } = require("../utils/commitPatterns");
    const { analyzeTechStack } = require("../utils/techStackAnalysis");
    const { analyzeComplexity } = require("../utils/complexityAnalysis");
    const { analyzeSecurity } = require("../utils/securityChecks");

    const execSync = require("child_process").execSync;
    const fs = require("fs");
    const path = require("path");
    const os = require("os");

    const user = await db.collection("users").findOne({ _id: new ObjectId(user_id) });
    const token = resolveTokenFromUser(user) || process.env.GITHUB_TOKEN || null;

    let cloneUrl = project.github_url;
    if (token) {
      try {
        const urlObj = new URL(cloneUrl);
        if (urlObj.hostname === "github.com") {
          urlObj.username = "x-access-token";
          urlObj.password = token;
          cloneUrl = urlObj.toString();
        }
      } catch (e) {
        // ignore URL parse errors, fallback to raw url
      }
    }

    // Path resolution: Local Interception
    let tempDir;
    let isCloned = false;

    if (project.local_path && fs.existsSync(project.local_path)) {
      tempDir = project.local_path;
    } else {
      tempDir = path.join(os.tmpdir(), `synthosphere_repo_${id}_${Date.now()}`);
      try {
        // Depth 50 strikes a good balance between retaining history for churn and minimizing IO blocking
        execSync(`git clone --depth 50 "${cloneUrl}" "${tempDir}"`, { stdio: 'inherit' });
        isCloned = true;
      } catch (cloneErr) {
        console.error(`[getProjectCodeQuality] Git clone failed for ${project.github_url}:`, cloneErr.message);
        return res.status(400).json({ error: "Offline/Invalid: Could not clone repository nor locate a valid fallback local_path." });
      }
    }

    try {
      // 1. Scan files natively utilizing our pre-built fileScanner utility
      const scannedFiles = scanFiles(tempDir);
      if (!scannedFiles || scannedFiles.length === 0) {
        throw new Error("Missing files in repository.");
      }

      // 2. Prep File Meta structures for remaining util analyses
      const filesData = [];
      const filePaths = [];
      let packageJson = null;

      for (const fileMeta of scannedFiles) {
        filePaths.push(fileMeta.filePath);
        
        const baseName = path.basename(fileMeta.filePath);
        if (baseName === "package.json") {
          try {
            packageJson = JSON.parse(fs.readFileSync(fileMeta.filePath, "utf-8"));
          } catch (e) {} 
        }

        // Limit heavy regex scanning strings to small files to preserve lightweight performance rules
        if (fileMeta.size < 200 * 1024) {
          const ext = fileMeta.extension;
          const codeExts = [".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".go", ".c", ".cpp", ".html", ".css", ".scss", ".md", ".json", ".rs", ".cs", ".php", ".rb", ".vue", ".sql", ".sh", ".bash", ".kt", ".swift", ".dart", ".scala", ".m", ".h", ".hpp"];
          if (codeExts.includes(ext) || baseName.startsWith("Dockerfile") || baseName.startsWith("README") || baseName.startsWith("LICENSE")) {
            try {
              const content = fs.readFileSync(fileMeta.filePath, "utf-8");
              // Store repo-relative path (strip tempDir prefix + normalize to forward slashes)
              const relPath = path.relative(tempDir, fileMeta.filePath).replace(/\\/g, "/");
              filesData.push({ file: relPath, content });
            } catch (e) {}
          }
        }
      }

      if (filesData.length === 0) {
        throw new Error("Missing files: No readable code files found to analyze.");
      }

      // 3. Trigger all utility sub-processes synchronously
      const churn = analyzeCodeChurn(tempDir);

      let commitsArray = [];
      try {
        const gitLogOut = execSync('git log --pretty=format:"%s"', { cwd: tempDir, encoding: "utf-8" });
        commitsArray = gitLogOut.split('\n').filter(Boolean);
      } catch (e) {}
      
      const commitPatterns = analyzeCommitPatterns(commitsArray);
      const techStack = analyzeTechStack(filePaths, packageJson);
      const complexity = analyzeComplexity(filesData);
      const security = analyzeSecurity(filesData, tempDir);

      // Cleanup cloned artifact to prevent disk overflow
      if (isCloned) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }

      // Return finalized aggregate format
      return res.status(200).json({
        repoName: project.repo_name,
        churn,
        commitPatterns,
        techStack,
        complexity,
        security
      });
    } catch (analysisError) {
      if (isCloned && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      console.error("[getProjectCodeQuality] Execution Error: ", analysisError);

      if (analysisError.message && analysisError.message.includes("Missing files")) {
         return res.status(400).json({ error: analysisError.message });
      }
      return res.status(500).json({ error: "Failed to analyze code quality." });
    }
  } catch (error) {
    console.error("getProjectCodeQuality outer error:", error.message);
    res.status(500).json({ error: "Failed to load code quality analysis." });
  }
}

/**
 * GET /api/projects/:id/trends
 * Fetch historical data, apply time filter and run trend/comparison utility analysis.
 */
async function getProjectTrends(req, res) {
  const { id } = req.params;
  const user_id = req.user.id;
  const range = req.query.range || "30d";

  try {
    const db = getDb();
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(id),
      user_id: new ObjectId(user_id),
    });

    if (!project || !project.repo_owner || !project.repo_name) {
      return res.status(404).json({ error: "Invalid repository or project not found." });
    }

    const user = await db.collection("users").findOne({ _id: new ObjectId(user_id) });
    const token = resolveTokenFromUser(user) || process.env.GITHUB_TOKEN || null;

    const trendsService = require("../services/github.trends.service");
    const { filterByTimeRange } = require("../utils/timeFilter");
    const { analyzeTrend } = require("../utils/trendAnalysis");
    const { analyzeEventImpact } = require("../utils/comparisonAnalysis");

    // 1. Fetch Data via GitHub API
    let rawStars, rawCommits;
    try {
      [rawStars, rawCommits] = await Promise.all([
        trendsService.getStarsHistory(project.repo_owner, project.repo_name, token),
        trendsService.getCommitsHistory(project.repo_owner, project.repo_name, token)
      ]);
    } catch (e) {
      if (e.response && (e.response.status === 403 || e.response.status === 429)) {
        return res.status(429).json({ error: "GitHub API limit exceeded or unauthorized." });
      }
      throw e;
    }

    // 2. Validate and filter time range
    const validRanges = ["30d", "90d", "365d", "custom"];
    if (!validRanges.includes(range)) {
       return res.status(400).json({ error: "Invalid range. Supported values: 30d, 90d, 365d, custom." });
    }

    const timeOpts = { dateKey: "date" };
    if (range === "custom") {
      if (!req.query.startDate) return res.status(400).json({ error: "startDate is required when using custom range." });
      timeOpts.startDate = req.query.startDate;
      if (req.query.endDate) timeOpts.endDate = req.query.endDate;
    }

    const filteredStars = filterByTimeRange(rawStars, range, timeOpts);
    const filteredCommits = filterByTimeRange(rawCommits, range, timeOpts);

    // 3. Process Statistical Trends
    const starsTrend = analyzeTrend(filteredStars, 7, { valueKey: "count", dateKey: "date" });
    const commitsTrend = analyzeTrend(filteredCommits, 7, { valueKey: "count", dateKey: "date" });

    // 4. Optional Before/After Comparison logic
    let comparison = null;
    if (req.query.eventDate) {
       comparison = analyzeEventImpact(
         { commits: filteredCommits, stars: filteredStars }, 
         req.query.eventDate, 
         { dateKey: "date", valueKey: "count" }
       );
    }

    // Return structured payload mirroring user specification
    res.status(200).json({
      stars: { ...starsTrend, timeline: filteredStars },
      commits: { ...commitsTrend, timeline: filteredCommits },
      comparison,
      _meta: {
        starsDataPoints: filteredStars.length,
        commitsDataPoints: filteredCommits.length
      }
    });

  } catch (err) {
    console.error("[getProjectTrends] error:", err.message);
    res.status(500).json({ error: "Failed to generate trends analysis." });
  }
}

/**
 * Handle data exports for the repository generating JSON, CSV, or PDF.
 *
 * Accepts a shaped payload from the frontend sectionExport.js utility:
 *   { section, title, exportedAt, payload }
 *
 * Falls back gracefully to the legacy { format, data } shape.
 */
async function exportProjectData(req, res) {
  try {
    const { id }             = req.params;
    const { format = "json", data, section, title, exportedAt, payload } = req.body;

    // Determine whether this is a shaped section export or a legacy call
    const isShaped = !!(section && payload);
    const exportData = isShaped
      ? { section, title, exportedAt, payload }  // shaped — pass through as-is
      : data;                                     // legacy — raw data object

    if (!exportData) {
      return res.status(400).json({ error: "No payload mapping provided for export conversion." });
    }

    // Build a section-scoped filename
    const sectionSlug = (section || "project").replace(/[^a-z0-9_]/gi, "_").toLowerCase();
    const baseFilename = `${sectionSlug}_export_${id}`;

    if (format === "json") {
      res.setHeader("Content-Disposition", `attachment; filename=${baseFilename}.json`);
      res.setHeader("Content-Type", "application/json");
      return res.send(JSON.stringify(exportData, null, 2));
    }

    if (format === "csv") {
      const csvStr = generateCsv(exportData);
      res.setHeader("Content-Disposition", `attachment; filename=${baseFilename}.csv`);
      res.setHeader("Content-Type", "text/csv");
      return res.send(csvStr);
    }

    if (format === "pdf") {
      const pdfBuffer = await generatePdf(exportData);
      res.setHeader("Content-Disposition", `attachment; filename=${baseFilename}.pdf`);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Length", pdfBuffer.length);
      return res.send(pdfBuffer);
    }

    return res.status(400).json({ error: "Unsupported conversion format." });
  } catch (err) {
    console.error("[exportProjectData] error:", err.message);
    res.status(500).json({ error: "Failed to assemble export package." });
  }
}


module.exports = {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  getProjectTree,
  getProjectMetrics,
  getProjectActivity,
  getProjectCodeQuality,
  getProjectTrends,
  exportProjectData,
};
