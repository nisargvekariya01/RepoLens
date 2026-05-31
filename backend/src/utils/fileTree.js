const axios = require("axios");

const SKIP_PATHS = ["node_modules", ".git", "dist", "build"];

const getAuthHeaders = (token) => {
  // Treat empty string, 'null', 'undefined' strings as no token
  const finalToken = (token && token.trim() && token !== 'null' && token !== 'undefined')
    ? token
    : (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim())
    ? process.env.GITHUB_TOKEN
    : null;

  if (!finalToken) return { Accept: "application/vnd.github+json" };
  return {
    Authorization: `Bearer ${finalToken}`,
    Accept: "application/vnd.github+json"
  };
};

function shouldSkipPath(filePath) {
  const parts = filePath.split("/");
  return parts.some(p => SKIP_PATHS.includes(p));
}

// Helper to convert flat paths to hierarchical structure
function buildVirtualTree(paths) {
  const root = {};
  
  for (const path of paths) {
    const parts = path.split("/");
    let current = root;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = i === parts.length - 1 ? null : {}; // null = file, {} = folder
      }
      current = current[part];
    }
  }
  
  return root;
}

// Helper to render hierarchical structure into ASCII
function renderAsciiTree(node, prefix = "", isLast = true) {
  let output = "";
  const children = Object.keys(node);
  
  // Sort: folders first, then files
  children.sort((a, b) => {
    const aIsFolder = node[a] !== null;
    const bIsFolder = node[b] !== null;
    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;
    return a.localeCompare(b);
  });

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const isChildLast = i === children.length - 1;
    const isFolder = node[child] !== null;
    
    const connector = isChildLast ? "└── " : "├── ";
    
    output += `${prefix}${connector}${child}${isFolder ? "/" : ""}\n`;
    
    if (isFolder) {
      const childPrefix = prefix + (isChildLast ? "    " : "│   ");
      output += renderAsciiTree(node[child], childPrefix, isChildLast);
    }
  }
  
  return output;
}

// Helper to render hierarchical structure into JSON format (matching generateFileTree)
function renderJsonTree(node, name = "root") {
  const childrenKeys = Object.keys(node);
  
  // Sort: folders first, then files
  childrenKeys.sort((a, b) => {
    const aIsFolder = node[a] !== null;
    const bIsFolder = node[b] !== null;
    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;
    return a.localeCompare(b);
  });

  const children = childrenKeys.map(childName => {
    const isFolder = node[childName] !== null;
    if (isFolder) {
      return renderJsonTree(node[childName], childName);
    }
    return { name: childName, type: "file" };
  });

  return {
    name,
    type: "folder",
    children
  };
}

async function fetchAndGenerateTree(owner, repo, token, maxDepth = 5, format = "ascii") {
  try {
    const headers = getAuthHeaders(token);

    const repoRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    const branch = repoRes.data.default_branch || "main";

    const treeRes = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      { headers }
    );

    const paths = (treeRes.data.tree || [])
      .filter(item => !shouldSkipPath(item.path))
      .filter(item => item.path.split("/").length <= maxDepth)
      .filter(item => item.type === "blob")
      .map(item => item.path);

    const virtualTree = buildVirtualTree(paths);

    if (format === "json") {
      return renderJsonTree(virtualTree);
    }

    let result = ".\n";
    result += renderAsciiTree(virtualTree);
    return result;
  } catch (error) {
    const status = error.response?.status;
    console.error(`[generateTreeString] error (HTTP ${status || 'unknown'}):`, error.message);

    // Return a graceful placeholder instead of throwing so the endpoint returns 200
    if (status === 403 || status === 429) {
      const reason = status === 429
        ? "GitHub API rate limit exceeded. Please try again later or add a GITHUB_TOKEN."
        : "Access denied (403). This may be a private repository or the GitHub token is missing/invalid.";

      if (format === "json") return { name: "root", type: "folder", children: [], _error: reason };
      return `.\n└── [${reason}]\n`;
    }

    throw new Error("Failed to generate tree from repository");
  }
}

function generateFileTree(rootPath, maxDepth = 5, currentDepth = 0) {
  const fs = require('fs');
  const path = require('path');
  
  if (currentDepth > maxDepth) return null;

  try {
    const stats = fs.statSync(rootPath);
    const name = path.basename(rootPath) || "root";
    
    if (stats.isFile()) {
      return {
        name,
        type: "file"
      };
    } 

    if (stats.isDirectory()) {
      const items = fs.readdirSync(rootPath);
      let children = [];

      for (const item of items) {
        if (SKIP_PATHS.includes(item)) continue;
        
        const itemPath = path.join(rootPath, item);
        const childNode = generateFileTree(itemPath, maxDepth, currentDepth + 1);
        if (childNode) {
          children.push(childNode);
        }
      }

      children.sort((a, b) => {
        if (a.type === "folder" && b.type !== "folder") return -1;
        if (a.type !== "folder" && b.type === "folder") return 1;
        return a.name.localeCompare(b.name);
      });

      return {
        name: currentDepth === 0 ? "root" : name,
        type: "folder",
        children
      };
    }
    
    return null;
  } catch (error) {
    console.error(`[generateFileTree] Error scanning ${rootPath}`, error);
    return null;
  }
}

module.exports = { fetchAndGenerateTree, buildVirtualTree, renderAsciiTree, generateFileTree };
