import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Copy, Download, RefreshCw, FolderTree } from "lucide-react";
import { getRepoTree } from "../api/project.api";
import AnalysisLoader from "./loading/AnalysisLoader";
import { TreeSkeleton } from "./loading/SkeletonComponents";
import { useSimulatedProgress } from "../hooks/useSimulatedProgress";

const TREE_STAGES = [
  "Connecting to GitHub API...",
  "Fetching root directory...",
  "Traversing file tree...",
  "Building directory structure...",
  "Rendering tree view...",
];
const TREE_DURATIONS = [2000, 3000, 4000, 3000, 2000];

const RepoStructure = ({ projectId }) => {
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState("ascii");

  const { progress, stageIndex, reset, markComplete } = useSimulatedProgress({
    stages: TREE_STAGES,
    stageDurations: TREE_DURATIONS,
    active: loading,
  });

  useEffect(() => {
    fetchTree();
  }, [projectId, format]);

  const [treeError, setTreeError] = useState(null); // non-blocking warning from backend

  const fetchTree = async () => {
    try {
      reset();
      setLoading(true);
      setError(null);
      setTreeError(null);
      const data = await getRepoTree(projectId, format);
      const treeData = data.tree;
      markComplete();
      // JSON format may carry a soft _error field (403/429 from GitHub)
      if (treeData && typeof treeData === "object" && treeData._error) {
        setTreeError(treeData._error);
        setTree(null);
      } else {
        setTimeout(() => setTree(treeData), 300);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load repository tree");
    } finally {
      setLoading(false);
    }
  };

  const [visibleChars, setVisibleChars] = useState(-1);

  useEffect(() => {
    if (!tree) return;
    
    setVisibleChars(0);
    const fullText = typeof tree === "object" ? JSON.stringify(tree, null, 2) : tree;
    const totalChars = fullText.length;
    
    // Calculate chunks to ensure animation completes in ~4 seconds max
    // 4000ms / 20ms = 200 frames
    // To make it look more organic like AI, we can use a slightly varied chunk size.
    const charsPerFrame = Math.max(1, Math.ceil(totalChars / 200));
    
    let current = 0;
    const interval = setInterval(() => {
      // Add slight randomness to chunk size to mimic AI typing speed variations
      const variation = Math.floor(Math.random() * (charsPerFrame / 2));
      current += charsPerFrame + (Math.random() > 0.5 ? variation : -variation);
      
      if (current >= totalChars) {
        setVisibleChars(-1); // complete
        clearInterval(interval);
      } else {
        setVisibleChars(Math.floor(current));
      }
    }, 20);
    
    return () => clearInterval(interval);
  }, [tree, format]);

  const getRenderableTree = () => {
    const fullText = typeof tree === "object" ? JSON.stringify(tree, null, 2) : tree;
    if (visibleChars === -1) return fullText;
    
    return fullText.slice(0, visibleChars);
  };

  const handleCopy = () => {
    if (tree) {
      navigator.clipboard.writeText(typeof tree === "object" ? JSON.stringify(tree, null, 2) : tree);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (tree) {
      const ext = format === "json" ? "json" : "txt";
      const blob = new Blob([typeof tree === "object" ? JSON.stringify(tree, null, 2) : tree], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `repo-structure.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (loading) {
    return (
      <>
        <AnalysisLoader
          variant="tree"
          size="md"
          title="Mapping Repository Tree..."
          subtitle="Fetching file structure from GitHub. This may take a moment for large repositories."
          progress={progress}
          currentStageIndex={stageIndex}
          showProgressBar={true}
          glowEffect={true}
          animated={true}
          stages={TREE_STAGES}
          estimatedTime="~5 sec"
        />
        <div className="mt-6 opacity-40 pointer-events-none">
          <TreeSkeleton />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-8 border border-neon-pink/30 bg-neon-pink/5 text-center rounded-lg relative overflow-hidden">
        <p className="text-neon-pink mb-4 glow-pink">{error}</p>
        <button
          onClick={fetchTree}
          className="inline-flex items-center px-4 py-2 border border-neon-pink/50 shadow-sm text-sm font-medium rounded-lg text-neon-pink hover:bg-neon-pink/10 transition-all"
        >
          <RefreshCw size={14} className="mr-2" /> Try Again
        </button>
      </div>
    );
  }

  return (
    <motion.div
      key="tree-content"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="glass-card flex flex-col h-full relative overflow-hidden shadow-[0_0_20px_rgba(168,85,247,0.15)]"
    >
      {treeError && (
        <div className="flex items-start gap-2 mx-4 mt-4 px-4 py-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 text-yellow-400 text-sm">
          <span>⚠️</span>
          <span>{treeError}</span>
        </div>
      )}
       {/* UI Header with actions */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-white/10 bg-white/5">
        <h3 className="text-lg font-semibold text-white flex items-center text-glow">
          <FolderTree size={18} className="mr-2 text-neon-purple" />
          Repository Structure
        </h3>
        <div className="flex space-x-3 items-center">
          <div className="flex border border-white/20 rounded-md overflow-hidden mr-2">
            <button
              onClick={() => setFormat("ascii")}
              className={`px-3 py-1 text-xs font-medium transition-colors ${format === "ascii" ? "bg-neon-purple text-white glow-purple" : "bg-transparent text-white/50 hover:bg-white/5 hover:text-white"}`}
            >
              ASCII
            </button>
            <button
              onClick={() => setFormat("json")}
              className={`px-3 py-1 text-xs font-medium transition-colors ${format === "json" ? "bg-neon-purple text-white glow-purple" : "bg-transparent text-white/50 hover:bg-white/5 hover:text-white"}`}
            >
              JSON
            </button>
          </div>
          <button
            onClick={handleCopy}
            className="inline-flex items-center px-3 py-1.5 shadow-sm text-xs font-medium rounded outline-none border border-white/20 text-white bg-surface hover:bg-surface/80 transition-all focus:ring-2 focus:ring-primary"
          >
            {copied ? (
              <span className="text-neon-green flex items-center drop-shadow-[0_0_5px_rgba(74,222,128,0.8)]">
                Copied!
              </span>
            ) : (
              <>
                <Copy size={14} className="mr-1.5 text-white/70" /> Copy
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="inline-flex items-center px-3 py-1.5 shadow-sm text-xs font-medium rounded outline-none border border-white/20 text-white bg-primary/20 hover:bg-primary/30 transition-all focus:ring-2 focus:ring-primary"
          >
            <Download size={14} className="mr-1.5 text-white/70" /> Download
          </button>
        </div>
      </div>

      <div className="p-6 overflow-auto bg-black/40 flex-1 max-h-[600px] font-mono">
        <pre className="text-sm font-mono whitespace-pre text-white/80 leading-relaxed font-light tracker-wide">
          {getRenderableTree()}
          {visibleChars !== -1 && <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="inline-block w-2 h-4 bg-neon-purple align-middle ml-1"></motion.span>}
        </pre>
      </div>
    </motion.div>
  );
};

export default RepoStructure;
